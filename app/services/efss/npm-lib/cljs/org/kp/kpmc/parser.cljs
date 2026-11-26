(ns org.kp.kpmc.parser
  (:require [clojure.string :as str]
            [instaparse.core :as insta]
            [org.kp.kpmc.io-node :as io])
  (:require-macros [instaparse.core :refer [defparser]]
                   [org.kp.kpmc.grammar-macros :refer [grammar-text]]))

(defparser x12-parser (grammar-text "x12.ebnf"))
(defparser envelope-parser (grammar-text "x12_x12_file.ebnf"))
(defparser function-body-parser (grammar-text "x12_function_body.ebnf"))
(defparser trans-body-parser (grammar-text "x12_trans_body.ebnf"))
(defparser ins-parser (grammar-text "x12_ins.ebnf"))

(defn parser-from-resource
  "Build parser from a resource file on disk, falling back to a precompiled parser.
  This keeps grammar-only edits effective without requiring code changes in this ns."
  [resource-name fallback-parser]
  (try
    (insta/parser (io/read-text (str "src/main/resources/" resource-name)))
    (catch :default _
      fallback-parser)))

(defn bytes->mb [n]
  (/ (js/Math.round (/ (* n 10.0) 1048576.0)) 10.0))

(defn memory-snapshot
  "Return Node memory snapshot map or nil when unavailable."
  []
  (when-let [mu (some-> js/process .-memoryUsage)]
    (let [m (mu)]
      {:rss-mb (bytes->mb (.-rss m))
       :heap-total-mb (bytes->mb (.-heapTotal m))
       :heap-used-mb (bytes->mb (.-heapUsed m))
        :external-mb (bytes->mb (.-external m))
        :array-buffers-mb (bytes->mb (or (.-arrayBuffers m) 0))})))

(defn log-memory!
  "Emit memory usage line when enabled."
  [enabled stage extra]
  (when enabled
    (when-let [m (memory-snapshot)]
      (println (str "[memory] " stage " " (pr-str (merge m (or extra {}))))))))

(defn reverso [input]
  (->> input reverse (apply str)))

(defn extract-text-by-span
  "Extract text from input string using span metadata [start end]."
  [input-text span]
  (when span
    (let [[start end] span]
      (subs input-text start end))))

(defn find-in-parse-tree
  "Find first occurrence of a keyword tag in parse tree."
  [tree keyword]
  (cond
    (not (sequential? tree)) nil
    (= (first tree) keyword) tree
    :else (some #(find-in-parse-tree % keyword) (rest tree))))

(defn find-all-nodes
  "Find all occurrences of a keyword tag in parse tree."
  [tree kw]
  (cond
    (not (sequential? tree)) []
    (= (first tree) kw) [tree]
    :else (mapcat #(find-all-nodes % kw) (rest tree))))

(defn function-body-node->text
  "Extract function_body source text. Prefer explicit raw_segment children and
  reconstruct delimiters; fall back to span extraction when needed."
  [input-text fb-node]
  (let [raw-segments (->> (find-all-nodes fb-node :raw_segment)
                          (map second)
                          (filter string?)
                          vec)]
    (if (seq raw-segments)
      (str (str/join "~" raw-segments) "~")
      (let [fb-span (insta/span fb-node)]
        (when fb-span (extract-text-by-span input-text fb-span))))))

(defn raw-segment-node->text
  "Extract text from a node that contains raw_segment descendants."
  [input-text node]
  (let [raw-segments (->> (find-all-nodes node :raw_segment)
                          (map second)
                          (filter string?)
                          vec)]
    (if (seq raw-segments)
      (str (str/join "~" raw-segments) "~")
      (let [span (insta/span node)]
        (when span (extract-text-by-span input-text span))))))

(defn create-parsers
  "Create parser map from compile-time defparser instances."
  []
  {:x12-parser x12-parser
   :envelope-parser envelope-parser
   :function-body-parser function-body-parser
  :trans-body-parser (parser-from-resource "x12_trans_body.ebnf" trans-body-parser)
  :ins-parser (parser-from-resource "x12_ins.ebnf" ins-parser)})

(defn split-edi-segments
  "Split raw EDI text into ordered segment strings without terminators."
  [text]
  (->> (str/split text #"~")
       (map str/trim)
       (remove str/blank?)
       vec))

(defn segment-id
  "Return segment identifier from a raw segment string."
  [segment]
  (first (str/split segment #"\*" 2)))

(defn segments->edi-text
  "Join ordered raw segments back into EDI text with segment terminators."
  [segments]
  (when (seq segments)
    (str (str/join "~" segments) "~")))

(defn find-next-segment-index
  "Find index of the next segment id between start (inclusive) and end (exclusive)."
  [segments start end seg-id]
  (loop [i start]
    (cond
      (>= i end) -1
      (= seg-id (segment-id (nth segments i))) i
      :else (recur (inc i)))))

(defn split-segments-by-isa
  "Split full segment stream into ISA/IEA-bounded interchange windows.
  Returns vector of {:start i :end j} where end is exclusive."
  [segments]
  (let [n (count segments)]
    (loop [idx 0
           ranges []]
      (if (>= idx n)
        ranges
        (let [isa-idx (find-next-segment-index segments idx n "ISA")]
          (if (neg? isa-idx)
            ranges
            (let [iea-idx (find-next-segment-index segments (inc isa-idx) n "IEA")]
              (if (neg? iea-idx)
                (conj ranges {:start isa-idx :end n})
                (let [iea-end (inc iea-idx)]
                  (recur iea-end
                         (conj ranges {:start isa-idx :end iea-end})))))))))))

(defn preview-text
  "Return a single-line text preview for debug logging."
  [s n]
  (let [v (or s "")
        limit (max 0 (or n 120))]
    (-> (subs v 0 (min limit (count v)))
        (str/replace #"\r" "\\r")
        (str/replace #"\n" "\\n"))))

(defn split-trans-body-by-ins
  "Split transaction body text into preamble and INS subscriber chunks."
  [text]
  (let [segments (split-edi-segments text)
        ins-indexes (->> segments
                         (map-indexed (fn [idx seg]
                                        (when (= "INS" (segment-id seg)) idx)))
                         (remove nil?)
                         vec)]
    (if (empty? ins-indexes)
      {:preamble-text (segments->edi-text segments)
       :subscriber-texts []}
      (let [head (first ins-indexes)
            preamble (subvec segments 0 head)
            subscriber-texts
            (->> (map-indexed
                  (fn [n start]
                    (let [end (or (nth ins-indexes (inc n) nil) (count segments))]
                      (segments->edi-text (subvec segments start end))))
                  ins-indexes)
                 (remove nil?)
                 vec)]
        {:preamble-text (segments->edi-text preamble)
         :subscriber-texts subscriber-texts}))))

(defn normalize-ins-node
  "Normalize INS parser output into a stable node shape for trans_body trees."
  [node]
  (if (and (sequential? node) (= (first node) :ins_subscriber))
    node
    (into [:ins_subscriber] (rest node))))

(defn parse-ins-text
  "Parse exactly one INS-started subscriber block without retaining other subscribers."
  ([text]
   (parse-ins-text text {}))
  ([text opts]
   (let [parser (or (:ins-parser opts)
                    (:ins-parser (create-parsers)))
         parsed (parser text :optimize :memory)]
     (if (insta/failure? parsed)
       (throw (ex-info "INS subscriber parsing failed"
                       {:type :ins-subscriber-parse-failed
                        :failure parsed}))
       (normalize-ins-node parsed)))))

(defn parse-trans-body-by-subscriber
  "Parse trans_body by preamble + INS subscriber chunks while keeping INS raw."
  [trans-parser ins-parser text opts]
  (let [{:keys [preamble-text subscriber-texts]} (split-trans-body-by-ins text)
        log-memory? (:log-memory? opts)
        log-every (max 1 (or (:log-every-n-subscribers opts) 100))
        preamble-nodes
        (if (and preamble-text (not (str/blank? preamble-text)))
          (let [parsed (trans-parser preamble-text :optimize :memory)]
            (if (insta/failure? parsed)
              {:failure parsed}
              {:nodes (vec (rest parsed))}))
          {:nodes []})]
    (if-let [failure (:failure preamble-nodes)]
      {:success false
       :error :trans-body-preamble-parse-failed
       :failure failure}
      (loop [remaining subscriber-texts
             idx 0
             acc (:nodes preamble-nodes)]
        (if (empty? remaining)
          {:success true
           :parse-tree (into [:trans_body] acc)
           :subscriber-count idx}
          (let [subscriber-text (first remaining)
                parsed (ins-parser subscriber-text :optimize :memory)]
            (when (or (zero? idx) (zero? (mod idx log-every)))
              (log-memory! log-memory?
                           "parse-trans-body-by-subscriber"
                           {:subscriber-index idx
                            :subscriber-count-total (count subscriber-texts)}))
            (if (insta/failure? parsed)
              {:success false
               :error :ins-subscriber-parse-failed
               :subscriber-index idx
               :failure parsed
               :subscriber-text subscriber-text}
              (let [nodes [[:segment_or_loop (normalize-ins-node parsed)]]]
                (recur (rest remaining)
                       (inc idx)
                       (into acc nodes))))))))))

(defn testX12
  "Parse a full sample X12 file with the monolithic grammar."
  []
  (let [sample (io/read-text "src/main/resources/edisamples/cityofatlanta_834_ga_20250831072309223.txt")
        parse-result (x12-parser sample :optimize :memory)]
    {:failure (insta/failure? parse-result)
     :parse-tree parse-result}))

(defn testX12-stage1
  "Stage 1: Parse with x12_x12_file.ebnf to extract outer envelope."
  []
  (let [sample (io/read-text "src/main/resources/edisamples/test1.txt")
        parse-result (envelope-parser sample :optimize :memory)]
    {:stage 1
     :description "Outer envelope parsing (ISA/GS/IEA)"
     :parse-tree parse-result
     :failure (insta/failure? parse-result)
     :sample-length (count sample)
     :sample-preview (subs sample 0 (min 200 (count sample)))}))

(defn testX12-stage2
  "Stage 2: Parse function_body with x12_function_body.ebnf."
  [stage1-result]
  (if (:failure stage1-result)
    {:stage 2
     :error "Stage 1 failed"
     :stage1-failure (:parse-tree stage1-result)}
    (let [input-text (io/read-text "src/main/resources/edisamples/cityofatlanta_834_ga_20250831072309223.txt")
          parse-tree (:parse-tree stage1-result)
          fg-tree (find-in-parse-tree parse-tree :functional-group)
          fg-span (when fg-tree (insta/span fg-tree))
          fg-text (when fg-span (extract-text-by-span input-text fg-span))
          parse-result (when fg-text (function-body-parser fg-text :optimize :memory))]
      {:stage 2
       :description "Function body parsing (ST/SE transaction sets)"
       :functional-group-span fg-span
       :functional-group-text-preview (when fg-text (subs fg-text 0 (min 200 (count fg-text))))
       :parse-tree parse-result
       :failure (and parse-result (insta/failure? parse-result))
       :parse-found (some? parse-result)})))

(defn testX12-stage3
  "Stage 3: Parse each trans_body with x12_trans_body.ebnf."
  [stage2-result]
  (if (or (:failure stage2-result) (not (:parse-found stage2-result)))
    {:stage 3
     :error "Stage 2 failed or no parse tree found"
     :stage2-info stage2-result}
    (let [parse-tree (:parse-tree stage2-result)
          input-text (io/read-text "src/main/resources/edisamples/cityofatlanta_834_ga_20250831072309223.txt")
          find-all-trans-sets (fn find-trans-sets [tree]
                                (cond
                                  (not (sequential? tree)) []
                                  (= (first tree) :transaction-set) [tree]
                                  :else (mapcat find-trans-sets (rest tree))))
          trans-sets (find-all-trans-sets parse-tree)
          parsed-bodies
          (map-indexed
           (fn [idx trans-set]
             (let [trans-body (find-in-parse-tree trans-set :trans-body)
                   trans-body-span (when trans-body (insta/span trans-body))
                   trans-body-text (when trans-body-span
                                     (extract-text-by-span input-text trans-body-span))
                   parse-result (when trans-body-text
                                  (trans-body-parser trans-body-text :optimize :memory))]
               {:transaction-set-index idx
                :trans-body-span trans-body-span
                :trans-body-text-preview (when trans-body-text
                                           (subs trans-body-text 0 (min 100 (count trans-body-text))))
                :parse-tree parse-result
                :failure (and parse-result (insta/failure? parse-result))}))
           trans-sets)]
      {:stage 3
       :description "Transaction body parsing (detailed data segments)"
       :transaction-set-count (count trans-sets)
       :parsed-bodies parsed-bodies
       :all-success (every? #(not (:failure %)) parsed-bodies)})))

(defn testX12-hierarchical
  "Orchestrate multi-stage hierarchical parsing and return stage results."
  []
  (let [stage1 (testX12-stage1)
        stage2 (testX12-stage2 stage1)
        stage3 (testX12-stage3 stage2)]
    {:stage1 stage1
     :stage2 stage2
     :stage3 stage3
     :summary {:stages-completed 3
               :stage1-success (not (:failure stage1))
               :stage2-success (not (:failure stage2))
               :stage3-success (when (contains? stage3 :all-success) (:all-success stage3))}}))

(defn parse-envelope
  "Stage 1: Parse X12 envelope structure (ISA/GS/GE/IEA)."
  [parser input-text]
  (let [result (parser input-text :optimize :memory)]
    (if (insta/failure? result)
      {:success false
       :error :envelope-parse-failed
       :failure result}
      {:success true
       :parse-tree result
       :input-text input-text})))

(defn extract-function-bodies
  "Extract all function_body text blobs from envelope parse result."
  [envelope-result]
  (when (:success envelope-result)
    (let [input-text (:input-text envelope-result)
          parse-tree (:parse-tree envelope-result)
          func-groups (find-all-nodes parse-tree :functional_group)]
      (for [fg func-groups
            :let [fb (find-in-parse-tree fg :function_body)
              span (when fb (insta/span fb))
              text (when fb (function-body-node->text input-text fb))]
            :when text]
        {:trans-body-text text
         :span span
         :functional-group fg}))))

(defn extract-function-bodies-lite
  "Extract function body blobs by scanning ISA/IEA then GS/GE boundaries.
  This avoids building a full Instaparse envelope tree in chunked mode."
  [input-text]
  (let [segments (split-edi-segments input-text)
        isa-ranges (split-segments-by-isa segments)]
    (reduce
     (fn [groups {:keys [start end]}]
       (loop [idx start
              acc groups]
         (if (>= idx end)
           acc
           (let [seg (nth segments idx)
                 sid (segment-id seg)]
              (if (= sid "GS")
                (let [ge-idx (find-next-segment-index segments (inc idx) end "GE")]
                  (if (neg? ge-idx)
                    (recur (inc idx) acc)
                    (let [body-segments (subvec segments (inc idx) ge-idx)
                          body-text (segments->edi-text body-segments)
                          fg-node [:functional_group
                                   [:function_header seg]
                                   [:function_body body-text]
                                   [:function_trailer (nth segments ge-idx)]]]
                      (recur (inc ge-idx)
                             (if body-text
                               (conj acc {:trans-body-text body-text
                                          :span nil
                                          :functional-group fg-node})
                               acc)))))
                (recur (inc idx) acc))))))
     []
     isa-ranges)))

(defn parse-function-body
  "Stage 2: Parse a single function_body to extract transaction sets."
  [parser func-body-info]
  (let [text (:trans-body-text func-body-info)
        result (parser text :optimize :memory)]
    (if (insta/failure? result)
      {:success false
       :error :function-body-parse-failed
       :failure result
       :input func-body-info}
      {:success true
       :parse-tree result
       :text text
       :functional-group (:functional-group func-body-info)})))

(defn extract-transaction-sets
  "Extract transaction set info from parsed function body."
  [func-body-result]
  (when (:success func-body-result)
    (let [text (:text func-body-result)
          parse-tree (:parse-tree func-body-result)
          trans-sets (find-all-nodes parse-tree :transaction_set)]
      (map-indexed
       (fn [idx ts]
         (let [header (find-in-parse-tree ts :trans_set_header)
               trailer (find-in-parse-tree ts :trans_set_trailer)
               body (find-in-parse-tree ts :trans_body)
               span (when body (insta/span body))
                 body-text (when body (raw-segment-node->text text body))]
           {:index idx
            :header header
            :trailer trailer
            :trans-body-text body-text
            :span span
            :transaction-set ts}))
       trans-sets))))

  (defn extract-transaction-sets-lite
    "Extract ST/SE transaction sets from a function body text blob.
    Transaction body is kept as raw text for the next parser stage."
    [func-body-info]
    (let [text (:trans-body-text func-body-info)
          segments (split-edi-segments (or text ""))
          n (count segments)]
      (loop [idx 0
             tx-idx 0
             out []]
        (if (>= idx n)
          out
          (let [seg (nth segments idx)
                sid (segment-id seg)]
            (if (= sid "ST")
              (let [se-idx (find-next-segment-index segments (inc idx) n "SE")]
                (if (neg? se-idx)
                  (recur (inc idx) tx-idx out)
                  (let [body-segments (subvec segments (inc idx) se-idx)
                        body-text (segments->edi-text body-segments)]
                    (recur (inc se-idx)
                           (inc tx-idx)
                           (conj out {:index tx-idx
                                      :header [:trans_set_header seg]
                                      :trailer [:trans_set_trailer (nth segments se-idx)]
                                      :trans-body-text body-text
                                      :span nil
                                      :transaction-set nil})))))
              (recur (inc idx) tx-idx out)))))))

(defn parse-trans-body
  "Stage 3: Parse a single transaction body into detailed segments."
  [parser ins-parser trans-set-info opts]
  (if-let [text (:trans-body-text trans-set-info)]
    (let [result (if ins-parser
                   (parse-trans-body-by-subscriber parser ins-parser text opts)
                   (let [parsed (parser text :optimize :memory)]
                     (if (insta/failure? parsed)
                       {:success false :failure parsed}
                       {:success true :parse-tree parsed})))]
      (if (:success result)
        {:success true
         :parse-tree (:parse-tree result)
         :parse_tree (:parse-tree result)
         :index (:index trans-set-info)
         :header (:header trans-set-info)
         :trailer (:trailer trans-set-info)
         :subscriber-count (:subscriber-count result)
         :subscriber_count (:subscriber-count result)}
        {:success false
         :error (or (:error result) :trans-body-parse-failed)
         :failure (:failure result)
         :subscriber-index (:subscriber-index result)
         :subscriber_index (:subscriber-index result)
         :index (:index trans-set-info)
         :header (:header trans-set-info)
         :trailer (:trailer trans-set-info)}
        ))
    {:success false
     :error :no-trans-body-text
     :index (:index trans-set-info)}))

(defn parse-x12-chunked
  "Parse X12 file in chunks for memory efficiency."
  ([filepath] (parse-x12-chunked filepath {}))
  ([filepath opts]
   (let [parsers (or (:parsers opts) (create-parsers))
       {:keys [envelope-parser function-body-parser trans-body-parser ins-parser]} parsers
         input-text (io/read-text filepath)
         on-tx (:on-transaction opts)
         log-memory? (:log-memory? opts)
         lightweight? (not (false? (:lightweight-chunked? opts)))
         _ (log-memory! log-memory? "parse-x12-chunked:start" {:file filepath :file-size (count input-text)})
         envelope-result (when-not lightweight? (parse-envelope envelope-parser input-text))
         _ (when (and (not lightweight?) (not (:success envelope-result)))
             (throw (ex-info "Envelope parsing failed" envelope-result)))
         _ (log-memory! log-memory?
                        "parse-x12-chunked:after-envelope"
                        {:success true
                         :lightweight-chunked lightweight?})
         func-bodies (if lightweight?
                       (extract-function-bodies-lite input-text)
                       (extract-function-bodies envelope-result))
         process-transaction (fn [trans-set-info]
                               (let [parsed (parse-trans-body trans-body-parser ins-parser trans-set-info opts)]
                                 (when on-tx (on-tx parsed))
                                 parsed))
         process-func-group (fn [fb-info]
                              (if lightweight?
                                {:success true
                                 :functional-group (:functional-group fb-info)
                                 :functional_group (:functional-group fb-info)
                                 :transactions (map process-transaction
                                                    (extract-transaction-sets-lite fb-info))}
                                (let [fb-result (parse-function-body function-body-parser fb-info)]
                                  (if (:success fb-result)
                                    {:success true
                                     :functional-group (:functional-group fb-info)
                                     :functional_group (:functional-group fb-info)
                                     :transactions (map process-transaction
                                                        (extract-transaction-sets fb-result))}
                                    fb-result))))
         func-group-results (if (:lazy? opts)
                              (map process-func-group func-bodies)
                              (doall (map process-func-group func-bodies)))
         _ (log-memory! log-memory? "parse-x12-chunked:after-functional-groups"
                        {:functional-group-count (count func-bodies)})]
     {:envelope (when envelope-result (:parse-tree envelope-result))
     :functional-groups func-group-results
     :functional_groups func-group-results
      :summary {:file filepath
                :file-size (count input-text)
                :functional-group-count (count func-bodies)
         :functional_group_count (count func-bodies)
                :lightweight-chunked lightweight?
                :total-transactions (reduce +
                                            0
                                            (map #(count (:transactions %))
                                                 (filter :success func-group-results)))}})))

(defn test-chunked-parse
  "Parse test file and return chunked parsing result."
  []
  (parse-x12-chunked "src/main/resources/edisamples/test1.txt"))

(defn parse-x12-full
  "Parse X12 file through all 3 stages and return unified parse tree."
  ([filepath] (println "reality checkino.........") (parse-x12-full filepath {}))
  ([filepath opts]
   (println "reality checkaufo.........")
   (let [parsers (or (:parsers opts) (create-parsers))
       {:keys [envelope-parser function-body-parser trans-body-parser ins-parser]} parsers
         log-memory? (:log-memory? opts)
         supplied-text (:input-text opts)
         _ (when-not supplied-text
           (log-memory! log-memory? "parse-x12-full:before-file-read" {:file filepath}))
         input-text (or supplied-text (io/read-text filepath))
      lite-func-bodies (extract-function-bodies-lite input-text)
      fb-index* (atom -1)
      input-segments (split-edi-segments input-text)
       _ (log-memory! log-memory? "parse-x12-full:after-file-read"
                      {:file filepath
                       :file-size (count input-text)
                       :segment-count (count input-segments)})
       _ (println (str "[diag] parse-x12-full file=" filepath
                       " segments=" (count input-segments)
                       " lite-fgs=" (count lite-func-bodies)))
         envelope (parse-envelope envelope-parser input-text)
         _ (when-not (:success envelope)
             (throw (ex-info "Envelope parsing failed" envelope)))
       _ (log-memory! log-memory? "parse-x12-full:after-envelope" {:success true})
         replace-node
         (fn replace-node [tree tag replacement-fn]
           (cond
             (not (sequential? tree)) tree
             (= (first tree) tag) (replacement-fn tree)
             :else (into [(first tree)]
                         (map #(replace-node % tag replacement-fn)
                              (rest tree)))))
         expand-function-body
         (fn [fb-node]
           (let [fb-index (swap! fb-index* inc)
                 scanned-text (:trans-body-text (nth lite-func-bodies fb-index nil))
                 raw-text (when (and (> (count fb-node) 1) (string? (second fb-node)))
                            (second fb-node))
                 source (cond
                          scanned-text "scan-gs-ge"
                          raw-text "stage1-node"
                          :else "raw-segment-fallback")
                 text (or scanned-text
                          raw-text
                          (function-body-node->text input-text fb-node))]
             (println (str "[diag] stage2 fb#" fb-index
                           " source=" source
                           " scanned-len=" (count (or scanned-text ""))
                           " raw-len=" (count (or raw-text ""))
                           " chosen-len=" (count (or text ""))))
             (if (and text (not (str/blank? text)))
               (let [body-segments (split-edi-segments text)
                     first-ids (->> body-segments (take 6) (map segment-id) (str/join ","))
                     _ (println (str "[diag] stage2 fb#" fb-index
                                     " first-ids=" first-ids
                                     " preview='" (preview-text text 140) "'"))
                     parsed (function-body-parser text :optimize :memory)]
                 (if (insta/failure? parsed)
                   (do
                     (println (str "[diag] stage2 fb#" fb-index " parse=failure"))
                     fb-node)
                   (let [tx-count (count (find-all-nodes parsed :transaction_set))]
                     (println (str "[diag] stage2 fb#" fb-index " parse=ok tx-count=" tx-count))
                     parsed)))
               fb-node)))
         expand-trans-body
         (fn [tb-node]
           (let [raw-text (when (and (> (count tb-node) 1) (string? (second tb-node)))
                            (second tb-node))
                 ;; Stage-2 trans_body node spans are relative to function-body text,
                 ;; not the full input file. Reconstruct from raw_segment descendants.
                 text (or raw-text
                          (raw-segment-node->text input-text tb-node))]
             (println (str "[diag] stage3 trans-body raw-len=" (count (or raw-text ""))
                           " chosen-len=" (count (or text ""))))
             (if (and text (not (str/blank? text)))
               (let [tb-segments (split-edi-segments text)
                     first-ids (->> tb-segments (take 8) (map segment-id) (str/join ","))
                     _ (println (str "[diag] stage3 trans-body first-ids=" first-ids
                                     " preview='" (preview-text text 140) "'"))
                     result (if ins-parser
                              (parse-trans-body-by-subscriber trans-body-parser ins-parser text opts)
                              (let [parsed (trans-body-parser text :optimize :memory)]
                                (if (insta/failure? parsed)
                                  {:success false :failure parsed}
                                  {:success true :parse-tree parsed})))]
                 (if (:success result)
                   (do
                     (println (str "[diag] stage3 trans-body parse=ok subscribers="
                                   (or (:subscriber-count result) "n/a")))
                     (:parse-tree result))
                   (do
                     (println (str "[diag] stage3 trans-body parse=failure error=" (:error result)))
                     tb-node)))
               tb-node)))
         tree-after-stage2 (replace-node (:parse-tree envelope)
                                         :function_body
                                         expand-function-body)
         _ (log-memory! log-memory? "parse-x12-full:after-stage2" nil)
         tree-after-stage3 (replace-node tree-after-stage2
                                         :trans_body
                                         expand-trans-body)
         _ (log-memory! log-memory? "parse-x12-full:after-stage3"
                {:isa-count (count (split-segments-by-isa input-segments))
                 :segment-count (count input-segments)})]
     tree-after-stage3)))

(defn parse-x12-text
  "Parse one complete ISA interchange supplied as text through all stages."
  ([input-text]
   (parse-x12-text input-text {}))
  ([input-text opts]
   (when (str/blank? input-text)
     (throw (ex-info "Cannot parse an empty ISA interchange" {:type :empty-isa})))
   (parse-x12-full "<streamed-isa>" (assoc opts :input-text input-text))))

(defn test-full-parse
  "Run full parse against test file and return unified parse tree."
  []
  (parse-x12-full "src/main/resources/edisamples/test1.txt"))