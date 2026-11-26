(ns org.kp.kpmc.companion-rules
  (:require [cljs.reader :as reader]
            [clojure.string :as str]
            [org.kp.kpmc.companion :as companion]
            [org.kp.kpmc.io-node :as io]
            [org.kp.kpmc.parser :as parser]))

(defn- blankish? [s]
  (or (nil? s) (str/blank? (str s))))

(defn- tag-name [x]
  (cond
    (keyword? x) (name x)
    (string? x) x
    :else (str x)))

(defn- tag= [node t]
  (and (sequential? node)
       (= (tag-name (first node)) t)))

(defn- normalize-usage [raw]
  (let [v (str/trim (or raw ""))]
    (case v
      "R" :required
      "S" :situational
      "Not Used" :not-used
      :unknown)))

(def editable-companion-guide-schema-version 1)

(defn- diagnostic
  [severity code message row field source-value]
  (cond-> {:severity severity
           :code code
           :message message}
    (:row-id row) (assoc :row-id (:row-id row))
    (:source-row row) (assoc :source-row (:source-row row))
    field (assoc :field field)
    (some? source-value) (assoc :source-value source-value)))

(defn- zero-pad2 [n]
  (if (< n 10) (str "0" n) (str n)))

(defn parse-companion-csv->model
  "Parse companion guide CSV into a rich model with legend, loops, and rows.
   Handles continuation option rows where cols A/B are blank."
  [csv-text]
  (let [rows (->> (companion/join-multiline-quoted-fields-with-source csv-text)
                  (map (fn [{:keys [text source-row]}]
                         {:source-row source-row
                          :values (-> (companion/parse-csv-line text)
                                      (concat (repeat 5 ""))
                                      vec
                                      (subvec 0 5))}))
                  vec)
        header-idx (first (keep-indexed
                           (fn [idx row]
                             (when (= "Ref. Des." (str/trim (nth (:values row) 1 ""))) idx))
                           rows))
        legend-rows (if header-idx (subvec rows 0 header-idx) [])
        body-rows (if header-idx (subvec rows (inc header-idx)) [])
        legend-start (first (keep-indexed
                             (fn [idx row]
                               (when (= "Legend" (str/trim (nth (:values row) 0 ""))) idx))
                             legend-rows))
        legend-pairs
        (if (nil? legend-start)
          []
          (->> (subvec legend-rows (inc legend-start))
               (map (fn [{:keys [values source-row]}]
                 {:row-id (str "legend-" source-row)
                  :source-row source-row
                  :key (str/trim (nth values 0 ""))
                  :value (str/trim (nth values 1 ""))}))
               (filter (fn [{:keys [key value]}]
                    (or (not (blankish? key)) (not (blankish? value)))))
               vec))]
    (loop [remaining body-rows
           current-loop nil
           current-element nil
           loops []
                elements []
                diagnostics []]
      (if (empty? remaining)
             {:schema-version editable-companion-guide-schema-version
              :source {:kind "csv"}
              :legend legend-pairs
         :loops loops
              :elements (cond-> elements current-element (conj current-element))
              :diagnostics diagnostics}
             (let [{:keys [values source-row]} (first remaining)
              [col-a col-b col-c col-d col-e] values
              a (str/trim col-a)
              b (str/trim col-b)
              c (str/trim col-c)
              d (str/trim col-d)
              e (str/trim col-e)
              loop-line? (str/starts-with? a "Loop:")
              ref-row? (not (blankish? b))
              cont-option-row? (and (blankish? a)
                                    (blankish? b)
                                    (not (blankish? d))
                                    (not (nil? current-element)))]
          (cond
            loop-line?
            (let [parsed-loop (companion/parse-loop-header a)
                  next-loop (when parsed-loop
                              (assoc parsed-loop
                                     :loop-id (str "loop-" source-row)
                                     :source-row source-row))]
              (recur (rest remaining)
                     next-loop
                     current-element
                     (if next-loop (conj loops next-loop) loops)
                     elements
                     (cond-> diagnostics
                       (nil? next-loop)
                       (conj (diagnostic :error :unrecognized-loop-header
                                         "Loop header could not be parsed."
                                         {:source-row source-row}
                                         :loop-name a)))))

            ref-row?
            (let [next-element {:row-id (str "element-" source-row)
                                :source-row source-row
                                :loop-id (:loop-id current-loop)
                                :loop current-loop
                                :label a
                                :segment-ref b
                                :usage (normalize-usage c)
                                :kp-element d
                                :element-description e
                                    :options []}
                                next-diagnostics
                                (cond-> diagnostics
                                  (= :unknown (:usage next-element))
                                  (conj (diagnostic :warning :unknown-usage
                                     "Usage value was not recognized."
                                     next-element :usage c))

                                  (nil? (companion/parse-segment-ref b))
                                  (conj (diagnostic :error :invalid-segment-ref
                                     "Segment reference could not be parsed."
                                     next-element :segment-ref b))

                                  (nil? current-loop)
                                  (conj (diagnostic :warning :missing-loop
                                     "Element is not associated with a parsed loop."
                                     next-element :loop-id nil)))]
              (recur (rest remaining)
                     current-loop
                     next-element
                     loops
                              (cond-> elements current-element (conj current-element))
                              next-diagnostics))

            cont-option-row?
                               (let [opt {:row-id (str "option-" source-row)
                                :source-row source-row
                                :usage (normalize-usage c)
                       :kp-element d
                                :element-description e}
                                next-diagnostics
                                (cond-> diagnostics
                                  (= :unknown (:usage opt))
                                  (conj (diagnostic :warning :unknown-usage
                                     "Usage value was not recognized."
                                     opt :usage c)))]
              (recur (rest remaining)
                     current-loop
                     (update current-element :options conj opt)
                     loops
                              elements
                              next-diagnostics))

            :else
                               (let [nonblank? (some (complement blankish?) [a b c d e])
                                orphan-option? (and (blankish? a)
                                     (blankish? b)
                                     (not (blankish? d))
                                     (nil? current-element))]
                            (recur (rest remaining)
                              current-loop
                              current-element
                              loops
                              elements
                              (cond-> diagnostics
                                orphan-option?
                                (conj (diagnostic :error :orphan-option
                                        "Continuation row has no preceding element."
                                        {:row-id (str "option-" source-row)
                                    :source-row source-row}
                                        nil nil))

                                (and nonblank? (not orphan-option?))
                                (conj (diagnostic :info :ignored-row
                                        "Row is not part of the supported guide structure."
                                        {:source-row source-row}
                                        nil nil)))))))))))

                        (defn- public-field-name
                          [field]
                          (get {:loop-id "loopId"
                                :row-id "rowId"
                                :schema-version "schemaVersion"
                                :segment-ref "segmentRef"
                                :segment-requirement "segmentRequirement"
                                :source-row "sourceRow"
                                :source-value "sourceValue"}
                               field
                               (some-> field name)))

                        (defn diagnostic->public
                          [item]
                          (cond-> {:severity (name (:severity item))
                                   :code (name (:code item))
                                   :message (:message item)}
                            (:row-id item) (assoc :rowId (:row-id item))
                            (:source-row item) (assoc :sourceRow (:source-row item))
                            (:field item) (assoc :field (public-field-name (:field item)))
                            (contains? item :source-value) (assoc :sourceValue (:source-value item))))

                        (defn model->editable-document
                          [model source-name]
                          {:schemaVersion editable-companion-guide-schema-version
                           :source (cond-> {:kind "csv"}
                                (not (blankish? source-name)) (assoc :name source-name))
                           :columns ["segmentName" "segmentRef" "usage" "kpElement" "elementDescription"]
                           :legend (mapv (fn [entry]
                                 {:rowId (:row-id entry)
                                  :sourceRow (:source-row entry)
                                  :key (:key entry)
                                  :value (:value entry)})
                               (:legend model))
                           :loops (mapv (fn [loop-def]
                                {:loopId (:loop-id loop-def)
                                 :sourceRow (:source-row loop-def)
                                 :loopName (:loop-name loop-def)
                                 :segmentId (:segment-id loop-def)
                                 :segmentDescription (:segment-description loop-def)
                                 :segmentRequirement (some-> (:segment-requirement loop-def) name)})
                              (:loops model))
                           :elements (mapv (fn [element]
                              {:rowId (:row-id element)
                               :sourceRow (:source-row element)
                               :loopId (:loop-id element)
                               :segmentName (:label element)
                               :segmentRef (:segment-ref element)
                               :usage (name (:usage element))
                               :kpElement (:kp-element element)
                               :elementDescription (:element-description element)
                               :options (mapv (fn [option]
                                      {:rowId (:row-id option)
                                       :sourceRow (:source-row option)
                                       :usage (name (:usage option))
                                       :kpElement (:kp-element option)
                                       :elementDescription (:element-description option)})
                                    (:options element))})
                                 (:elements model))
                           :diagnostics (mapv diagnostic->public (:diagnostics model))})

        (defn- public-diagnostic->internal
          [item]
          (cond-> {:severity (keyword (or (:severity item) "info"))
                   :code (keyword (or (:code item) "unknown"))
                   :message (or (:message item) "")}
            (:rowId item) (assoc :row-id (:rowId item))
            (:sourceRow item) (assoc :source-row (:sourceRow item))
            (:field item) (assoc :field (keyword (:field item)))
            (contains? item :sourceValue) (assoc :source-value (:sourceValue item))))

        (defn validate-editable-document
          "Validate and normalize a public editable companion document."
          [document]
          (let [schema-version (:schemaVersion document)
                public-loops (if (vector? (:loops document)) (:loops document) [])
                public-elements (if (vector? (:elements document)) (:elements document) [])
                loop-ids (map :loopId public-loops)
                row-ids (concat (map :rowId public-elements)
                                (mapcat #(map :rowId (:options %)) public-elements))
                duplicate-loop-ids (->> loop-ids frequencies (keep (fn [[id n]] (when (> n 1) id))) set)
                duplicate-row-ids (->> row-ids frequencies (keep (fn [[id n]] (when (> n 1) id))) set)
                base-diagnostics
                (cond-> []
                  (not= editable-companion-guide-schema-version schema-version)
                  (conj (diagnostic :error :unsupported-schema-version
                                    "Editable companion guide schema version is not supported."
                                    nil :schema-version schema-version)))
                loops
                (mapv (fn [loop-def]
                        {:loop-id (:loopId loop-def)
                         :source-row (:sourceRow loop-def)
                         :loop-name (:loopName loop-def)
                         :segment-id (:segmentId loop-def)
                         :segment-description (:segmentDescription loop-def)
                         :segment-requirement (some-> (:segmentRequirement loop-def) keyword)})
                      public-loops)
                loop-index (into {} (map (juxt :loop-id identity) loops))
                element-results
                (mapv
                 (fn [element]
                   (let [row {:row-id (:rowId element) :source-row (:sourceRow element)}
                         usage (keyword (or (:usage element) "unknown"))
                         segment-ref (:segmentRef element)
                         loop-id (:loopId element)
                         options
                         (mapv (fn [option]
                                 {:row-id (:rowId option)
                                  :source-row (:sourceRow option)
                                  :usage (keyword (or (:usage option) "unknown"))
                                  :kp-element (or (:kpElement option) "")
                                  :element-description (or (:elementDescription option) "")})
                               (or (:options element) []))
                         option-diagnostics
                         (mapcat (fn [option]
                                   (let [option-row {:row-id (:row-id option)
                                                     :source-row (:source-row option)}]
                                     (cond-> []
                                       (not (contains? #{:required :situational :not-used} (:usage option)))
                                       (conj (diagnostic :error :unknown-usage
                                                         "Usage value is not supported."
                                                         option-row :usage (name (:usage option))))

                                       (or (blankish? (:row-id option))
                                           (contains? duplicate-row-ids (:row-id option)))
                                       (conj (diagnostic :error :duplicate-row-id
                                                         "Row ID is missing or duplicated."
                                                         option-row :row-id (:row-id option))))))
                                 options)
                         element-diagnostics
                         (cond-> []
                           (not (contains? #{:required :situational :not-used} usage))
                           (conj (diagnostic :error :unknown-usage
                                             "Usage value is not supported."
                                             row :usage (:usage element)))

                           (nil? (companion/parse-segment-ref segment-ref))
                           (conj (diagnostic :error :invalid-segment-ref
                                             "Segment reference could not be parsed."
                                             row :segment-ref segment-ref))

                           (not (contains? loop-index loop-id))
                           (conj (diagnostic :error :missing-loop-reference
                                             "Element refers to a loop that does not exist."
                                             row :loop-id loop-id))

                           (or (blankish? (:row-id row))
                               (contains? duplicate-row-ids (:row-id row)))
                           (conj (diagnostic :error :duplicate-row-id
                                             "Row ID is missing or duplicated."
                                             row :row-id (:row-id row))))]
                     {:element {:row-id (:rowId element)
                                :source-row (:sourceRow element)
                                :loop-id loop-id
                                :loop (get loop-index loop-id)
                                :label (or (:segmentName element) "")
                                :segment-ref segment-ref
                                :usage usage
                                :kp-element (or (:kpElement element) "")
                                :element-description (or (:elementDescription element) "")
                                :options options}
                      :diagnostics (vec (concat element-diagnostics option-diagnostics))}))
                 public-elements)
                loop-diagnostics
                (mapcat (fn [loop-def]
                          (let [row {:row-id (:loop-id loop-def)
                                     :source-row (:source-row loop-def)}]
                            (cond-> []
                              (or (blankish? (:loop-id loop-def))
                                  (contains? duplicate-loop-ids (:loop-id loop-def)))
                              (conj (diagnostic :error :duplicate-row-id
                                                "Loop ID is missing or duplicated."
                                                row :loop-id (:loop-id loop-def)))

                              (not (contains? #{nil :required :situational}
                                              (:segment-requirement loop-def)))
                              (conj (diagnostic :error :invalid-segment-requirement
                                                "Segment requirement is not supported."
                                                row :segment-requirement
                                                (:segment-requirement loop-def))))))
                        loops)
                diagnostics (vec (concat base-diagnostics
                                         loop-diagnostics
                                         (mapcat :diagnostics element-results)))
                valid? (not-any? #(= :error (:severity %)) diagnostics)]
            {:valid? valid?
             :diagnostics diagnostics
             :model {:schema-version editable-companion-guide-schema-version
                     :source (:source document)
                     :legend (mapv (fn [entry]
                                     {:row-id (:rowId entry)
                                      :source-row (:sourceRow entry)
                                      :key (or (:key entry) "")
                                      :value (or (:value entry) "")})
                                   (or (:legend document) []))
                     :loops loops
                     :elements (mapv :element element-results)
                     :diagnostics (mapv public-diagnostic->internal
                                        (or (:diagnostics document) []))}}))

(defn- parse-length-limit [desc]
  (when-let [m (re-find #"(?i)up to\s+(\d+)\s+bytes" (or desc ""))]
    (js/parseInt (second m) 10)))

(defn- split-options [s]
  (let [norm (-> (or s "")
                 (str/replace #"\s+or\s+" ",")
                 (str/replace #"\bor\b" ","))]
    (->> (str/split norm #",")
         (map str/trim)
         (remove blankish?)
         vec)))

(defn- placeholder-kind [kp]
  (cond
    (= kp "<Blank>") :blank
    (= kp "<YYMMDD>") :yymmdd
    (= kp "<CCYYMMDD>") :ccyymmdd
    (= kp "<HHMM>") :hhmm
    (= kp "<HHMMSS>") :hhmmss
    (= kp "<HHMMSSDD>") :hhmmssdd
    (= kp "<Number>") :number
    (= kp "<Unique Number>") :unique-number
    (= kp "<Area Code><Phone>") :phone10
    (= kp "<Subscriber SSN>") :ssn
    (= kp "Subscriber SSN") :ssn
    (= kp "XXXXXXXXXXXXXXX") :x-mask
    (= kp "<All Possible Codes>") :all-possible-codes
    (= kp "All values") :all-values
    :else nil))

(defn- all-values-336-rule?
  "Special companion guide case: 'All Values,336(Hire Date)' means value must be 336."
  [kp]
  (boolean (re-matches #"(?i)\s*All\s+Values\s*,\s*336(?:\s*\(.*\))?\s*" (or kp ""))))

(defn- enum-valid?
  "For enum rules, required fields must match allowed values; optional fields may be blank."
  [usage allowed-values value]
  (let [v (str/trim (or value ""))
        allowed? (contains? allowed-values v)]
    (if (= usage :required)
      allowed?
      (or (blankish? v) allowed?))))

(defn- hd01-rule?
  "Detect the HD01 companion rule that is conditioned by BGN08 values."
  [rule]
  (and (= "HD01" (:segment-ref rule))
       (= "001, 021, 024, 030" (str/trim (or (:kp-element rule) "")))))

(defn- hd01-allowed-by-bgn08
  "Allowed HD01 values based on captured BGN08 action code.
   BGN08=2 => 001/021/024, BGN08=4 or RX => 030.
   If BGN08 is unavailable, keep permissive base set."
  [context]
  (let [bgn08 (str/trim (or (get context "BGN08") ""))]
    (cond
      (= bgn08 "2") #{"001" "021" "024"}
      (or (= bgn08 "4") (= bgn08 "RX")) #{"030"}
      :else #{"001" "021" "024" "030"})))

(defn- external-ref-token?
  "True for angle-bracket tokens that represent external references, e.g. <Fed Tax Id>."
  [kp]
  (boolean (re-matches #"^<[^>]+>$" (or kp ""))))

(defn- contains-angle-token?
  "True when a KP element expression contains any angle-bracket token text."
  [kp]
  (boolean (re-find #"[<>]" (or kp ""))))

(defn- build-rule-predicate [rule]
  (let [kp (:kp-element rule)
        desc (:element-description rule)
        p-kind (placeholder-kind kp)
        ref-match (re-find #"^<Same as\s+([A-Z0-9]{2,3}[0-9]{2})>$" kp)
        option-values (->> (concat [kp] (map :kp-element (:options rule)))
                           (map str/trim)
                           (mapcat split-options)
                           (remove blankish?)
                           (remove #(= % "<Blank>"))
                           (remove external-ref-token?)
                           distinct
                           vec)
        x-max-len (parse-length-limit desc)]
    (cond
      (= :not-used (:usage rule))
      {:kind :not-used
       :validate (fn [{:keys [value]}]
                   {:valid (blankish? value)
                    :expected :blank})}

      ref-match
      {:kind :cross-ref
       :validate (fn [{:keys [value context]}]
                   (let [ref (second ref-match)
                         expected (get context ref)]
                     (if (blankish? expected)
                       {:valid true :note :missing-reference-context}
                       {:valid (= (str value) (str expected))
                        :expected expected
                        :actual value}))) }

      (= p-kind :blank)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (blankish? value)})}

      (= p-kind :yymmdd)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d{6}" (or value "")))})}

      (= p-kind :ccyymmdd)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d{8}" (or value "")))})}

      (= p-kind :hhmm)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d{4}" (or value "")))})}

      (= p-kind :hhmmss)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d{6}" (or value "")))})}

      (= p-kind :hhmmssdd)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d{6,8}" (or value "")))})}

      (or (= p-kind :number) (= p-kind :unique-number))
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d+" (or value "")))})}

      (= p-kind :phone10)
      {:kind :placeholder
       :validate (fn [{:keys [value]}] {:valid (boolean (re-matches #"\d{10}" (or value "")))})}

      (= p-kind :ssn)
      {:kind :placeholder
       :validate (fn [{:keys [value]}]
                   {:valid (or (blankish? value)
                               (boolean (re-matches #"\d{9}" (or value ""))))})}

      (= p-kind :x-mask)
      {:kind :pattern-hint
       :validate (fn [{:keys [value]}]
                   {:valid (if x-max-len
                             (<= (count (or value "")) x-max-len)
                             (not (blankish? value)))})}

      (= p-kind :all-values)
      {:kind :open
       :validate (fn [_] {:valid true})}

      (all-values-336-rule? kp)
      {:kind :enum
       :allowed #{"336"}
       :validate (fn [{:keys [value]}]
           {:valid (enum-valid? (:usage rule) #{"336"} value)
            :allowed ["336"]})}

      (= p-kind :all-possible-codes)
      {:kind :external-code-list
        :validate (fn [{:keys [value]}]
               {:valid (if (= (:usage rule) :required)
               (not (blankish? value))
               true)
                :note :external-code-list})}

      (hd01-rule? rule)
      {:kind :enum
       :allowed #{"001" "021" "024" "030"}
       :validate (fn [{:keys [value context]}]
                   (let [allowed (hd01-allowed-by-bgn08 context)]
                     {:valid (enum-valid? (:usage rule) allowed value)
                      :allowed (vec allowed)
                      :based-on {:BGN08 (get context "BGN08")}}))}

       (and (contains-angle-token? kp)
         (str/includes? kp "<Blank>")
         (seq option-values))
       {:kind :enum
        :allowed (set option-values)
        :validate (fn [{:keys [value]}]
              {:valid (or (blankish? value)
                 (contains? (set option-values) (str/trim (or value ""))))
            :allowed (vec (concat ["<Blank>"] option-values))})}

       (and (nil? p-kind)
         (nil? ref-match)
         (contains-angle-token? kp))
       {:kind :placeholder
        :validate (fn [{:keys [value]}]
              (if (= (:usage rule) :required)
             {:valid (not (blankish? value)) :expected :non-blank}
             {:valid true}))}

      (seq option-values)
      {:kind :enum
       :allowed (set option-values)
       :validate (fn [{:keys [value]}]
                   {:valid (enum-valid? (:usage rule) (set option-values) value)
                    :allowed option-values})}

      :else
      {:kind :literal
       :validate (fn [{:keys [value]}] {:valid (= (str/trim (or value "")) kp) :expected kp})})))

(defn compile-rules
  "Compile parsed companion model rows into executable rule maps with cljs predicates."
  [model]
  (->> (:elements model)
       (map (fn [e]
              (let [{:keys [segment-id position]} (or (companion/parse-segment-ref (:segment-ref e)) {})
                    pred (build-rule-predicate e)]
                (merge
                 {:rule-id (str (or segment-id "UNK") (or (zero-pad2 (or position 0)) "00"))
                  :segment-id segment-id
                  :position position
                  :usage (:usage e)
                  :segment-ref (:segment-ref e)
                  :label (:label e)
                  :loop-name (get-in e [:loop :loop-name])
                    :segment-requirement (get-in e [:loop :segment-requirement])
                  :segment-description (get-in e [:loop :segment-description])
                  :kp-element (:kp-element e)
                  :options (:options e)
                  :element-description (:element-description e)}
                 pred))))
       (filter :segment-id)
       vec))

(defn parse-companion-csv->rules
  [csv-file]
  (println "[parse-companion-csv->rules]")
  (let [model (if (map? csv-file)
                csv-file
                (parse-companion-csv->model (io/read-text csv-file)))]
    {:model model
     :rules (compile-rules model)}))

(defn- to-ref [segment-id position]
  (str segment-id (zero-pad2 position)))

(defn- extract-seg-id [data-segment-node]
  (some (fn [child]
          (when (tag= child "seg_id")
            (second child)))
        (rest data-segment-node)))

(defn- extract-unit-values [data-segment-node]
  (->> (rest data-segment-node)
       (filter #(tag= % "data_segment_unit"))
       (map (fn [unit]
              (let [second-val (second unit)]
                (if (map? second-val)
                  (nth unit 2 nil)
                  second-val))))
       vec))

(defn- annotate-unit [unit annotation]
  (let [second-val (second unit)]
    (if (map? second-val)
      (let [val (nth unit 2 nil)]
        [(first unit) (merge second-val annotation) val])
      [(first unit) annotation second-val])))

(defn- split-raw-segment
  "Split raw segment text into [segment-id values]."
  [raw]
  (let [parts (str/split (or raw "") #"\*" -1)
        seg-id (first parts)
        values (vec (rest parts))]
    [seg-id values]))

(defn- safe-read-json
  [text]
  (try
    (js->clj (js/JSON.parse text) :keywordize-keys true)
    (catch :default _ nil)))

(defn- env-get
  [k]
  (aget (.-env js/process) k))

(declare normalize-ssn)

(defn- now-ms []
  (.now js/Date))

(defn- now-iso []
  (.toISOString (js/Date.)))

(defn- ensure-parent-dir-for-file!
  [output-file]
  (when-not (blankish? output-file)
    (let [path-mod (js/require "path")
          fs (js/require "fs")
          dir (.dirname path-mod output-file)]
  (.mkdirSync fs dir (clj->js {:recursive true})))))

(defn- append-ndjson-line!
  [output-file payload]
  (when-not (blankish? output-file)
    (ensure-parent-dir-for-file! output-file)
    (.appendFileSync (js/require "fs")
                     output-file
                     (str (.stringify js/JSON (clj->js payload)) "\n")
                     "utf8")))

(defn- init-progress-file!
  [output-file]
  (when-not (blankish? output-file)
    (ensure-parent-dir-for-file! output-file)
    (.writeFileSync (js/require "fs") output-file "" "utf8")))

(defn- emit-progress!
  [opts event]
  (let [cb (or (:on-progress opts) (:onProgress opts))
        output-file (or (:progress-output-file opts) (:progressOutputFile opts))]
    (when cb
      (try
        (cb (clj->js event))
        (catch :default e
          (println "[progress-callback-error]" (.-message e)))))
    (append-ndjson-line! output-file event)))

    (defn- normalize-heartbeat-every
      [opts]
      (let [raw (or (:heartbeat-every-db-attempts opts)
        (:heartbeatEveryDbAttempts opts)
        0)
      n (if (number? raw)
          raw
          (js/parseInt (str raw) 10))]
        (if (or (js/isNaN n) (<= n 0)) 0 n)))

(defn- count-ins-segments
  "Count INS data segments in a parsed tree for progress percentage calculations."
  [tree]
  (letfn [(count-node [node]
            (if-not (sequential? node)
              0
              (let [is-ins?
                    (cond
                      (tag= node "data_segment")
                      (= "INS" (extract-seg-id node))

                      (tag= node "raw_segment")
                      (= "INS" (first (split-raw-segment (second node))))

                      :else false)]
                (+ (if is-ins? 1 0)
                   (reduce + 0 (map count-node (rest node)))))))]
    (count-node tree)))

(defn- build-subscriber-key
  [subscriber-index subscriber-ssn run-id]
  (if (re-matches #"\d{9}" (normalize-ssn subscriber-ssn))
    (normalize-ssn subscriber-ssn)
    (str (or run-id "run") "-subscriber-" (or subscriber-index 0))))

(defn- default-subscriber-progress
  [subscriber-index subscriber-ssn]
  {:subscriber-index subscriber-index
   :subscriber-ssn (normalize-ssn subscriber-ssn)
   :started-at (now-iso)
   :structure-total 0
   :structure-passed 0
   :structure-failed 0
   :db-attempted 0
   :db-passed 0
   :db-failed 0
   :db-skipped 0
   :lookup-status-counts {}
   :failure-reasons []})

(defn- update-subscriber-progress
  [sp rule-valid? lookup-result db-context]
  (let [lookup-applied? (boolean (:lookup-applied lookup-result))
        lookup-valid? (boolean (:valid lookup-result))
        lookup-executed? (boolean (:executed? lookup-result))
        lookup-status (:status lookup-result)
        reason (:reason lookup-result)]
    (cond-> (-> sp
                (update :subscriber-ssn (fn [cur]
                                          (or (when (re-matches #"\d{9}" (normalize-ssn cur)) cur)
                                              (normalize-ssn (:subscriber-ssn db-context))
                                              cur)))
                (update :structure-total inc)
                (update (if rule-valid? :structure-passed :structure-failed) inc)
                (update-in [:lookup-status-counts lookup-status] (fnil inc 0)))
      lookup-applied?
      (-> (update :db-attempted inc)
          (update (if lookup-valid? :db-passed :db-failed) inc)
          (cond-> (not lookup-executed?) (update :db-skipped inc)))

      (not lookup-applied?)
      (update :db-skipped inc)

      (and (not rule-valid?) reason)
      (update :failure-reasons conj reason)

      (and lookup-applied? (not lookup-valid?) reason)
      (update :failure-reasons conj reason))))

(defn- subscriber-final-status
  [subscriber-progress db-validation-enabled?]
  (let [structure-failed (:structure-failed subscriber-progress)
        db-failed (:db-failed subscriber-progress)
        db-attempted (:db-attempted subscriber-progress)
        db-skipped (:db-skipped subscriber-progress)]
    (cond
      (or (> structure-failed 0) (> db-failed 0)) "completed-failed"
      (and db-validation-enabled?
           (or (zero? db-attempted) (> db-skipped 0))) "completed-partial"
      :else "completed-passed")))

(defn- build-subscriber-progress-summary
  [subscriber-statuses]
  {:total (count subscriber-statuses)
   :completed-passed (count (filter #(= "completed-passed" (:status %)) subscriber-statuses))
   :completed-failed (count (filter #(= "completed-failed" (:status %)) subscriber-statuses))
   :completed-partial (count (filter #(= "completed-partial" (:status %)) subscriber-statuses))})

(defn- merge-subscriber-progress-summary
  [summary subscriber-statuses]
  (merge-with + summary (build-subscriber-progress-summary subscriber-statuses)))

(defn- normalize-ssn
  "Canonicalize SSN to digits-only for binds and in-memory state."
  [s]
  (-> (or s "")
      str
      str/trim
      (str/replace #"\D" "")))

(defn- normalize-identification-type-code
  [v]
  (let [x (-> (or v "") str str/trim)]
    (if (= x "34") "SSN" x)))

(defn- normalize-lookup-value
  [column value]
  (let [v (-> (or value "") str str/trim)]
    (cond
      (= column "SUBSCRIBER_SSN") (normalize-ssn v)
      (= column "IDENTIFICATION_VALUE") (normalize-ssn v)
      (= column "IDENTIFICATION_TYPE_CODE") (normalize-identification-type-code v)
      :else (str/upper-case v))))

(defn- lookup-expected-candidates
  "Generate candidate expected values to tolerate DB formatting for date/time columns."
  [value]
  (let [v (-> (or value "") str str/trim)
        digits (str/replace v #"\D" "")]
    (cond
      (blankish? v) #{""}
      (boolean (re-matches #"\d{8}" v)) (cond-> #{v digits}
                                             (>= (count digits) 6) (conj (subs digits 0 6)))
      (boolean (re-matches #"\d{6,8}" v)) (cond-> #{v digits}
                                               (>= (count digits) 6) (conj (subs digits 0 6)))
      :else #{v})))

(defn- lookup-value-match?
  [actual-values expected]
  (let [exp-candidates (lookup-expected-candidates expected)]
    (boolean (some #(contains? actual-values %) exp-candidates))))

(defn- extract-subscriber-ssns-from-parse-tree
  "Extract subscriber SSNs per INS block from parsed tree.
   Prefers REF02 when REF01=0F, falls back to NM109 when NM108=34."
  [parse-tree]
  (let [state* (atom {:in-subscriber? false :current nil :out []})
        finalize! (fn []
                    (when (:in-subscriber? @state*)
                      (let [ssn (normalize-ssn (:current @state*))]
                        (swap! state* update :out conj
                               (when (re-matches #"\d{9}" ssn) ssn)))))
        visit-segment!
        (fn [seg-id values]
          (let [vals (vec (map #(-> (or % "") str str/trim) values))]
            (cond
              (= seg-id "INS")
              (do (finalize!)
                  (swap! state* assoc :in-subscriber? true :current nil))

              (and (= seg-id "REF")
                   (= "0F" (nth vals 0 ""))
                   (re-matches #"\d{9}" (normalize-ssn (nth vals 1 ""))))
              (swap! state* assoc :current (normalize-ssn (nth vals 1 "")))

              (and (= seg-id "NM1")
                   (= "34" (nth vals 7 ""))
                   (re-matches #"\d{9}" (normalize-ssn (nth vals 8 "")))
                   (blankish? (:current @state*)))
              (swap! state* assoc :current (normalize-ssn (nth vals 8 "")))

              :else nil)))
        walk
        (fn walk [node]
          (when (sequential? node)
            (cond
              (tag= node "data_segment")
              (let [seg-id (extract-seg-id node)
                    values (extract-unit-values node)]
                (visit-segment! seg-id values))

              (tag= node "raw_segment")
              (let [[seg-id values] (split-raw-segment (second node))]
                (visit-segment! seg-id values))

              :else nil)
            (doseq [c (rest node)]
              (walk c))))]
    (walk parse-tree)
    (finalize!)
    (:out @state*)))

(defn- safe-sql-ident?
  [s]
  (boolean (re-matches #"[A-Z][A-Z0-9_]*" (or s ""))))

(defn- safe-sql-literal
  [s]
  (str/replace (or s "") #"'" "''"))

(defn- resolve-env-name
  [opts]
  (or (:env-name opts)
      (:envName opts)
      (env-get "envName")
      (env-get "ENV_NAME")))

(defn- db-env-keys
  [env-name]
  {:user-key (str "host." env-name "-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.user")
   :password-key (str "host." env-name "-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.password")
   :url-key (str "host." env-name "-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.url")})

(defn- resolve-db-config
  [opts]
  (let [env-name (resolve-env-name opts)]
    (when-not (blankish? env-name)
      (let [{:keys [user-key password-key url-key]} (db-env-keys env-name)
            user (env-get user-key)
            password (env-get password-key)
            connect-string (env-get url-key)]
        {:env-name env-name
         :user-key user-key
         :password-key password-key
         :url-key url-key
         :user user
         :password password
         :connect-string connect-string
         :valid? (and (not (blankish? user))
                      (not (blankish? password))
                      (not (blankish? connect-string)))}))))

(defn- resolve-subscriber-only-db-validation?
  "Default to subscriber-only DB validation unless explicitly disabled.
   Accepts opts flag or env var SUBSCRIBER_ONLY_DB_VALIDATION=false."
  [opts]
  (let [raw (or (:subscriber-only-db-validation? opts)
                (:subscriberOnlyDbValidation opts)
                (env-get "SUBSCRIBER_ONLY_DB_VALIDATION")
                true)
        v (if (string? raw) (-> raw str str/trim str/lower-case) raw)]
    (cond
      (boolean? v) v
      (string? v) (not (contains? #{"false" "0" "no" "n"} v))
      :else true)))

(defn- loop-name->scope
  [loop-name]
  (let [v (str/trim (or loop-name ""))]
    (cond
      (or (blankish? v)
          (= v "Header")
          (str/starts-with? v "1000")) :commercial
      (re-matches #"^[2-9].*" v) :subscriber
      :else :commercial)))

(defn- ensure-current-subscriber
  [db-state*]
  (let [cur (:current-subscriber @db-state*)]
    (when (nil? cur)
      (swap! db-state* assoc :current-subscriber
             {:index (inc (or (:subscriber-index-offset @db-state*) 0))
              :ssn nil
              :refs {}}))))

(defn- start-new-subscriber!
  [db-state*]
  (let [{:keys [current-subscriber subscribers subscriber-ssns subscriber-index-offset]} @db-state*
        persisted (if (and current-subscriber
                           (or (not (blankish? (:ssn current-subscriber)))
                               (seq (:refs current-subscriber))))
                    (conj subscribers current-subscriber)
                    subscribers)
        local-index (inc (count persisted))
        next-index (+ (or subscriber-index-offset 0) local-index)
        subscriber-ssn (nth subscriber-ssns (dec local-index) nil)]
    (swap! db-state* assoc
           :subscribers persisted
           :current-subscriber {:index next-index :ssn subscriber-ssn :refs {}})))

(defn- maybe-capture-subscriber-ssn!
  [db-state* context seg-id position value]
  (let [v (str/trim (or value ""))
     ssn (normalize-ssn v)]
    (cond
      (and (= seg-id "REF")
           (= position 2)
           (= (str/trim (or (get context "REF01") "")) "0F")
     (re-matches #"\d{9}" ssn))
   (do
     (ensure-current-subscriber db-state*)
     (swap! db-state* assoc-in [:current-subscriber :ssn] ssn))

      (and (= seg-id "NM1")
           (= position 9)
           (= (str/trim (or (get context "NM108") "")) "34")
     (re-matches #"\d{9}" ssn)
           (blankish? (get-in @db-state* [:current-subscriber :ssn])))
   (do
     (ensure-current-subscriber db-state*)
     (swap! db-state* assoc-in [:current-subscriber :ssn] ssn))

      :else nil)))

(defn- update-db-state!
  [db-state* context rule seg-id position value]
  (let [ref (to-ref seg-id position)
        scope (loop-name->scope (:loop-name rule))
        v (str/trim (or value ""))]
    (when (and (= seg-id "INS") (= position 1))
      (start-new-subscriber! db-state*))
    (when (= scope :subscriber)
      (ensure-current-subscriber db-state*))
    (when (not (blankish? v))
      (if (= scope :commercial)
        (swap! db-state* assoc-in [:commercial-refs ref] value)
        (swap! db-state* assoc-in [:current-subscriber :refs ref] value)))
    ;; Capture SSN from EDI wherever it appears; loop disambiguation can be imperfect.
    (maybe-capture-subscriber-ssn! db-state* context seg-id position value)))

(defn- current-db-context
  [db-state* rule]
  (let [scope (loop-name->scope (:loop-name rule))
        state @db-state*]
    (if (= scope :commercial)
      {:scope :commercial
       :subscriber-index nil
       :subscriber-ssn nil
       :refs (:commercial-refs state)}
      (let [cur (:current-subscriber state)]
        {:scope :subscriber
         :subscriber-index (:index cur)
         :subscriber-ssn (:ssn cur)
         :refs (:refs cur)}))))

(defn- execute-oracle-query-sync
  ([db-config sql binds]
   (execute-oracle-query-sync db-config sql binds {}))
  ([db-config sql binds opts]
   (let [child-proc (js/require "child_process")
         fetch-all? (true? (:fetch-all? opts))
         script (str
                 "const oracledb=require('oracledb');"
                 "(async()=>{"
                 "const p=JSON.parse(process.argv[1]);"
                 "let conn=null;"
                 "try{"
                 "conn=await oracledb.getConnection({user:p.user,password:p.password,connectString:p.connectString});"
                 "const r=await conn.execute(p.sql,p.binds,{outFormat:oracledb.OUT_FORMAT_OBJECT});"
                 "const rows=r.rows||[];"
                 "const row=rows[0]||null;"
                 "const hit=(row&&(row.HIT_COUNT??row.hit_count))!=null?Number(row.HIT_COUNT??row.hit_count):rows.length;"
                 "const outRows=p.fetchAll?rows:rows.slice(0,10);"
                 "console.log(JSON.stringify({ok:true,hitCount:hit,rowCount:rows.length,row:row,rows:outRows}));"
                 "}catch(e){"
                 "console.log(JSON.stringify({ok:false,error:e&&e.message?e.message:String(e),code:e&&e.code?e.code:null,errorNum:e&&e.errorNum?e.errorNum:null}));"
                 "}finally{if(conn){try{await conn.close();}catch(_){}}}"
                 "})();")
         payload (js/JSON.stringify (clj->js {:user (:user db-config)
                                              :password (:password db-config)
                                              :connectString (:connect-string db-config)
                                              :sql sql
                                              :binds binds
                                              :fetchAll fetch-all?}))]
     (try
      (let [out (.execFileSync child-proc "node" (clj->js ["-e" script payload])
                (clj->js {:encoding "utf8"
                :maxBuffer (* 16 1024 1024)}))]
         (or (safe-read-json out) {:ok false :error :invalid-db-response}))
       (catch :default e
         (let [stdout (some-> e .-stdout str)
               stderr (some-> e .-stderr str)
               parsed-out (safe-read-json stdout)
               parsed-err (safe-read-json stderr)]
           (or (when (map? parsed-out) parsed-out)
               (when (map? parsed-err) parsed-err)
               {:ok false
                :error (or (when-not (blankish? stdout) stdout)
                           (when-not (blankish? stderr) stderr)
                           (.-message e)
                           :db-exec-failed)})))))))

(defn- regex-escape
  [s]
  (str/replace (or s "") #"([\\.^$|?*+(){}\[\]])" "\\$1"))

(defn- maybe-date-safe-sql
  "For date-like EDI values (YYYYMMDD), retry Oracle lookups by comparing
   formatted DB date/timestamp text instead of implicit DATE conversion."
  [sql column text-value]
  (let [v (str/trim (or text-value ""))]
    (when (and (string? sql)
               (not (blankish? column))
               (boolean (re-matches #"\d{8}" v)))
      (let [escaped-column (regex-escape column)
            alias-pattern (js/RegExp. (str "([A-Za-z_][A-Za-z0-9_]*\\.)" escaped-column "\\s*=\\s*:value") "i")
            bare-pattern (js/RegExp. (str "\\b" escaped-column "\\b\\s*=\\s*:value") "i")
            with-alias (str/replace sql alias-pattern (str "to_char($1" column ", 'YYYYMMDD') = :value"))
            rewritten (if (= with-alias sql)
                        (str/replace sql bare-pattern (str "to_char(" column ", 'YYYYMMDD') = :value"))
                        with-alias)]
        (when (not= rewritten sql)
          rewritten)))))

(defn- build-date-sample-sql
  "Rewrite a count(*) lookup into a diagnostic query that returns sample raw and
   formatted values of the date column, so its true DB format can be logged.
   Neutralizes the failing '<column> = :value' predicate with '1 = 1' and limits
   the result to a few rows. Returns nil when no such predicate is found."
  [sql column]
  (when (and (string? sql) (not (blankish? column)))
    (let [escaped (regex-escape column)
          alias-pattern (js/RegExp. (str "([A-Za-z_][A-Za-z0-9_]*)\\." escaped "\\s*=\\s*:value") "i")
          bare-pattern (js/RegExp. (str "\\b" escaped "\\b\\s*=\\s*:value") "i")
          alias-match (.match sql alias-pattern)
          col-expr (cond
                     alias-match (str (aget alias-match 1) "." column)
                     (re-find bare-pattern sql) column
                     :else nil)]
      (when col-expr
        (let [neutralized (if alias-match
                            (str/replace sql alias-pattern "1 = 1")
                            (str/replace sql bare-pattern "1 = 1"))
              select-pattern (js/RegExp. "select\\s+count\\(\\*\\)\\s+as\\s+HIT_COUNT" "i")
              inner (str/replace neutralized select-pattern
                                 (str "select "
                                      "to_char(" col-expr ", 'YYYY-MM-DD HH24:MI:SS') as SAMPLE_FMT, "
                                      "dump(" col-expr ") as SAMPLE_DUMP"))]
          (when (not= inner sql)
            (str "select * from (" inner ") where rownum <= 5")))))))

(defn- filter-binds-for-sql
  "Keep only bind values whose ':name' placeholder still appears in the SQL."
  [sql binds]
  (let [m (js->clj binds)]
    (clj->js
     (into {}
           (filter (fn [[k _]]
                     (str/includes? sql (str ":" (name k))))
                   m)))))

(defn- log-date-format-diagnostic!
  "Run a diagnostic query for a failing date-column lookup and print the actual
   DB date values (formatted + raw dump) so the stored format can be inspected."
  [db-config sql column {:keys [table segment-ref edi-value] :as ctx} binds]
  (when-let [diag-sql (build-date-sample-sql sql column)]
    (let [diag-binds (filter-binds-for-sql diag-sql binds)
          diag (execute-oracle-query-sync db-config diag-sql diag-binds)]
      (println "[date-format-diagnostic]"
               (pr-str {:table table
                        :column column
                        :segment-ref segment-ref
                        :edi-value edi-value
                        :ok (:ok diag)
                        :sample-rows (:rows diag)
                        :error (:error diag)})))))

(defn- build-input-ssn-cte
  [ssns]
  (let [indexed (vec (map-indexed vector ssns))
        rows (map (fn [[idx _]]
                    (if (zero? idx)
                      (str "select :ssn_" idx " as ssn from dual")
                      (str "select :ssn_" idx " from dual")))
                  indexed)
        binds (into {}
                    (map (fn [[idx ssn]] [(keyword (str "ssn_" idx)) ssn]) indexed))]
    {:sql (str/join " union all " rows)
     :binds (clj->js binds)}))

(defn- subscriber-bulk-select-sql
  [table column]
  (when (and (safe-sql-ident? table) (safe-sql-ident? column))
    (let [t (safe-sql-literal table)
          c (safe-sql-literal column)
          value-expr
          (case column
            "SUBSCRIBER_SSN" "replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')"
            "IDENTIFICATION_VALUE" "replace(replace(t.IDENTIFICATION_VALUE, '-', ''), ' ', '')"
            (str "to_char(t." column ")"))
          person-child #{"TAP_PERSON_ADDRESS" "TAP_PERSON_PHONE" "TAP_PERSON_EMAIL"
                         "TAP_PERSON_LANGUAGE" "TAP_PERSON_EXTERNAL_IDENTIFIER"}
          person-coverage-child #{"TAP_PERSON_COVERAGE_ATTRIBUTE" "TAP_PERSON_COVERAGE_ADDRESS"
                                  "TAP_PERSON_COVERAGE_AFFILIATION"
                                  "TAP_PERSON_COVERAGE_AFFILIATION_COMM"
                                  "TAP_PERSON_COVERAGE_PREMIUM_RATE"
                                  "TAP_PERSON_COVERAGE_RIDER"}]
      (cond
        (= table "TAP_COVERAGE")
        (str "select a.ssn as SSN, '" t "' as TABLE_NAME, '" c "' as COLUMN_NAME, "
             (if (= column "SUBSCRIBER_SSN")
               "replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')"
               (if (str/ends-with? column "_DATE")
                 (str "to_char(c." column ", 'YYYYMMDD')")
                 (str "to_char(c." column ")")))
             " as VALUE "
             "from anchor a "
             "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "
             "join MEMBER_OWNER.TAP_COVERAGE c on c.COVERAGE_ID = pc.COVERAGE_ID "
             "where c." column " is not null")

        (= table "TAP_PERSON")
        (str "select a.ssn as SSN, '" t "' as TABLE_NAME, '" c "' as COLUMN_NAME, "
             (if (str/ends-with? column "_DATE")
               (str "to_char(p." column ", 'YYYYMMDD')")
               (str "to_char(p." column ")"))
             " as VALUE "
             "from anchor a "
             "join MEMBER_OWNER.TAP_PERSON p on p.PERSON_ID = a.PERSON_ID "
             "where p." column " is not null")

        (= table "TAP_PERSON_COVERAGE")
        (str "select a.ssn as SSN, '" t "' as TABLE_NAME, '" c "' as COLUMN_NAME, to_char(pc." column ") as VALUE "
             "from anchor a "
             "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "
             "where pc." column " is not null")

        (contains? person-child table)
        (str "select a.ssn as SSN, '" t "' as TABLE_NAME, '" c "' as COLUMN_NAME, " value-expr " as VALUE "
             "from anchor a "
             "join MEMBER_OWNER." table " t on t.PERSON_ID = a.PERSON_ID "
             "where t." column " is not null")

        (contains? person-coverage-child table)
        (str "select a.ssn as SSN, '" t "' as TABLE_NAME, '" c "' as COLUMN_NAME, to_char(t." column ") as VALUE "
             "from anchor a "
             "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "
             "join MEMBER_OWNER." table " t on t.PERSON_ID = pc.PERSON_ID and t.COVERAGE_ID = pc.COVERAGE_ID "
             "where t." column " is not null")

           (= table "TAP_PLAN_GROUP")
           (str "select a.ssn as SSN, '" t "' as TABLE_NAME, '" c "' as COLUMN_NAME, to_char(pg." column ") as VALUE "
             "from anchor a "
             "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "
             "join MEMBER_OWNER.TAP_COVERAGE c on c.COVERAGE_ID = pc.COVERAGE_ID "
             "join MEMBER_OWNER.TAP_PLAN_GROUP pg on pg.PLAN_GROUP_ID = c.PLAN_GROUP_ID "
             "where pg." column " is not null")

        :else nil))))

(defn- build-subscriber-bulk-query
  [ssns lookup-doc]
  (let [specs (->> (:specs lookup-doc)
                   (filter :enabled?)
                   (mapcat (fn [spec]
                             (let [targets (if (seq (:cases spec))
                                             (:cases spec)
                                             [spec])]
                               (map (fn [target]
                                      [(:table target) (:column target)])
                                    targets))))
                   (filter (fn [[t c]] (and (safe-sql-ident? t) (safe-sql-ident? c))))
                   distinct
                   vec)]
    (when (and (seq ssns) (seq specs))
      (let [{:keys [sql binds]} (build-input-ssn-cte ssns)
            selects (->> specs
                         (map (fn [[t c]] (subscriber-bulk-select-sql t c)))
                         (remove nil?)
                         vec)]
        (when (seq selects)
          {:sql (str
                 "with input_ssn(ssn) as (" sql "), "
                 "anchor as ("
                 "select distinct i.ssn, pei.PERSON_ID "
                 "from input_ssn i "
                 "join MEMBER_OWNER.TAP_PERSON_EXTERNAL_IDENTIFIER pei "
                 "on pei.IDENTIFICATION_TYPE_CODE = 'SSN' "
                 "and replace(replace(pei.IDENTIFICATION_VALUE, '-', ''), ' ', '') = i.ssn"
                 ") "
                 "select distinct SSN, TABLE_NAME, COLUMN_NAME, VALUE from ("
                 (str/join " union all " selects)
                 ")")
           :binds binds
           :spec-count (count specs)
           :ssn-count (count ssns)})))))

(defn- row-col
  [row k]
  (or (get row k)
      (get row (keyword k))
      (get row (keyword (str/lower-case k)))
      (get row (keyword (str/upper-case k)))))

(defn- build-subscriber-prefetch-index
  [rows]
  (reduce
   (fn [acc row]
     (let [ssn (normalize-ssn (or (row-col row "SSN") ""))
           table (str/upper-case (str (or (row-col row "TABLE_NAME") "")))
           column (str/upper-case (str (or (row-col row "COLUMN_NAME") "")))
           value (normalize-lookup-value column (or (row-col row "VALUE") ""))]
       (if (or (blankish? ssn) (blankish? table) (blankish? column) (blankish? value))
         acc
         (update-in acc [ssn table column] (fnil conj #{}) value))))
   {}
   rows))

(defn- load-subscriber-prefetch-data
  [db-config parse-tree lookup-doc]
  (let [ssns (extract-subscriber-ssns-from-parse-tree parse-tree)
        plan (build-subscriber-bulk-query ssns lookup-doc)]
    (if (nil? plan)
      {:ok true :values {} :ssn-count (count ssns) :row-count 0 :spec-count 0}
      (let [q (execute-oracle-query-sync db-config (:sql plan) (:binds plan) {:fetch-all? true})]
        (if (:ok q)
          {:ok true
           :values (build-subscriber-prefetch-index (:rows q))
           :ssn-count (:ssn-count plan)
           :spec-count (:spec-count plan)
           :row-count (:rowCount q)}
          {:ok false
           :error (:error q)
           :ssn-count (:ssn-count plan)
           :spec-count (:spec-count plan)
           :row-count 0})))))

(defn- make-single-query-subscriber-executor
  [opts prefetch-data]
  (let [subscriber-only? (resolve-subscriber-only-db-validation? opts)
        supported? (fn [table column]
                     (and (safe-sql-ident? table)
                          (safe-sql-ident? column)
                          (some? (subscriber-bulk-select-sql table column))))]
    (fn [{:keys [spec value db-context]}]
      (let [scope (:scope db-context)
            ssn (normalize-ssn (:subscriber-ssn db-context))
            table (:table spec)
            column (:column spec)
            normalized-value (normalize-lookup-value column value)]
        (cond
          (and subscriber-only? (not= scope :subscriber))
          {:executed? false
           :valid true
           :status :skipped-non-subscriber-scope
           :reason :subscriber-only-db-validation}

          (not= scope :subscriber)
          {:executed? false
           :valid true
           :status :skipped-non-subscriber-scope
           :reason :single-query-subscriber-mode}

          (not (re-matches #"\d{9}" ssn))
          {:executed? false
           :valid true
           :status :missing-subscriber-ssn
           :reason :subscriber-lookups-require-ssn}

          (not (supported? table column))
          {:executed? false
           :valid true
           :status :skipped-unmapped-subscriber-attribute
           :reason {:table table :column column}}

          (not (:ok prefetch-data))
          {:executed? true
           :valid false
           :status :db-error
           :reason (:error prefetch-data)}

          :else
          (let [actual-values (get-in prefetch-data [:values ssn table column] #{})
                hit? (lookup-value-match? actual-values normalized-value)]
            {:executed? true
             :valid hit?
             :status (if hit? :db-hit :db-miss)
             :hit-count (if hit? 1 0)
             :scope scope
             :subscriber-ssn ssn}))))))


      (defn- subscriber-sql-by-table
        "Build SSN-anchored subscriber validation SQL for a mapped table/column.
         Returns nil when table strategy is not yet defined."
        [table column]
        (let [person-child #{"TAP_PERSON_ADDRESS" "TAP_PERSON_PHONE" "TAP_PERSON_EMAIL"
                 "TAP_PERSON_LANGUAGE" "TAP_PERSON_EXTERNAL_IDENTIFIER"}
           person-coverage-child #{"TAP_PERSON_COVERAGE_ATTRIBUTE" "TAP_PERSON_COVERAGE_ADDRESS"
                    "TAP_PERSON_COVERAGE_AFFILIATION"
                    "TAP_PERSON_COVERAGE_AFFILIATION_COMM"
                    "TAP_PERSON_COVERAGE_PREMIUM_RATE"
                    "TAP_PERSON_COVERAGE_RIDER"}
           ssn-expr "replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')"]
          (cond
         (= table "TAP_COVERAGE")
         (str "select count(*) as HIT_COUNT from MEMBER_OWNER.TAP_COVERAGE c "
           "where " ssn-expr " = :ssn and "
           (if (= column "SUBSCRIBER_SSN")
             "replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')"
             (str "c." column))
           " = :value")

         (= table "TAP_PERSON")
         (str "select count(*) as HIT_COUNT "
           "from MEMBER_OWNER.TAP_COVERAGE c "
           "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "
           "join MEMBER_OWNER.TAP_PERSON p on p.PERSON_ID = pc.PERSON_ID "
           "where " ssn-expr " = :ssn and p." column " = :value")

         (= table "TAP_PERSON_COVERAGE")
         (str "select count(*) as HIT_COUNT "
           "from MEMBER_OWNER.TAP_COVERAGE c "
           "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "
           "where " ssn-expr " = :ssn and pc." column " = :value")

         (contains? person-child table)
         (str "select count(*) as HIT_COUNT "
           "from MEMBER_OWNER.TAP_COVERAGE c "
           "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "
           "join MEMBER_OWNER." table " t on t.PERSON_ID = pc.PERSON_ID "
           "where " ssn-expr " = :ssn and t." column " = :value")

         (contains? person-coverage-child table)
         (str "select count(*) as HIT_COUNT "
           "from MEMBER_OWNER.TAP_COVERAGE c "
           "join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "
           "join MEMBER_OWNER." table " t on t.PERSON_ID = pc.PERSON_ID and t.COVERAGE_ID = pc.COVERAGE_ID "
           "where " ssn-expr " = :ssn and t." column " = :value")

         (= table "TAP_PLAN_GROUP")
         (str "select count(*) as HIT_COUNT "
           "from MEMBER_OWNER.TAP_COVERAGE c "
           "join MEMBER_OWNER.TAP_PLAN_GROUP pg on pg.PLAN_GROUP_ID = c.PLAN_GROUP_ID "
           "where " ssn-expr " = :ssn and pg." column " = :value")

         :else
         nil)))

(defn- make-oracle-lookup-executor
  [opts]
  (let [db-config (resolve-db-config opts)
        subscriber-only? (resolve-subscriber-only-db-validation? opts)]
    (fn [{:keys [spec value db-context]}]
      (let [scope (:scope db-context)
        ssn (:subscriber-ssn db-context)
        normalized-ssn (normalize-ssn ssn)
            table (:table spec)
            column (:column spec)
            segment-ref (:segment-ref spec)
            text-value (str (or value ""))
        normalized-value (normalize-lookup-value column text-value)
            subscriber-sql (subscriber-sql-by-table table column)
            commercial-query
            (if (and (= table "TAP_COVERAGE") (= column "SUBSCRIBER_SSN"))
              {:sql "select count(*) as HIT_COUNT from MEMBER_OWNER.TAP_COVERAGE where replace(replace(SUBSCRIBER_SSN, '-', ''), ' ', '') = :value"
               :binds (clj->js {:value (normalize-ssn text-value)})}
              {:sql (str "select count(*) as HIT_COUNT from MEMBER_OWNER." table
                         " where " column " = :value")
               :binds (clj->js {:value value})})
            sql (if (= scope :subscriber)
                  subscriber-sql
                  (:sql commercial-query))]
        (cond
          (str/starts-with? (or table "") "TAP_STAGING_")
          {:executed? false
           :valid true
           :status :skipped-staging-table
           :reason {:table table :column column}}

          (nil? db-config)
          {:executed? false
           :valid false
           :status :db-config-missing
           :reason :missing-env-name}

          (not (:valid? db-config))
          {:executed? false
           :valid false
           :status :db-config-invalid
           :reason {:env-name (:env-name db-config)
                    :user-key (:user-key db-config)
                    :password-key (:password-key db-config)
                    :url-key (:url-key db-config)}}

          (and subscriber-only? (not= scope :subscriber))
          {:executed? false
           :valid true
           :status :skipped-non-subscriber-scope
           :reason :subscriber-only-db-validation}

          (and (= scope :subscriber)
            (not (re-matches #"\d{9}" normalized-ssn)))
          {:executed? false
           :valid true
           :status :missing-subscriber-ssn
           :reason :subscriber-lookups-require-ssn}

          (and (= scope :subscriber) (nil? sql))
          {:executed? false
           :valid true
           :status :skipped-unmapped-subscriber-attribute
           :reason {:table table :column column}}

          :else
            (let [binds (if (= scope :subscriber)
              (clj->js {:value normalized-value :ssn normalized-ssn})
              (:binds commercial-query))
                q-initial (execute-oracle-query-sync db-config sql binds)
                date-error? (and (not (:ok q-initial))
                                 (boolean (re-find #"ORA-01847|ORA-01861" (str (:error q-initial)))))
                _ (when date-error?
                    (log-date-format-diagnostic! db-config sql column
                                                 {:table table
                                                  :segment-ref segment-ref
                                                  :edi-value text-value}
                                                 binds))
                date-safe-sql (when date-error?
                                (maybe-date-safe-sql sql column text-value))
                q (if date-safe-sql
                    (execute-oracle-query-sync db-config date-safe-sql binds)
                    q-initial)
                hit (or (:hitCount q) 0)
                ok? (and (:ok q) (> hit 0))]
            {:executed? true
             :valid (boolean ok?)
             :status (if (:ok q)
                       (if ok? :db-hit :db-miss)
                       :db-error)
             :hit-count hit
             :scope scope
             :subscriber-ssn (when (= scope :subscriber) normalized-ssn)
             :reason (when-not (:ok q) (:error q))
             :sql (or date-safe-sql sql)}))))))

(defn validate-lookup-doc
  "Validate and return a canonical lookup document containing non-empty :specs."
  [lookup-spec-file lookup-doc]
  (when-not (map? lookup-doc)
    (throw (ex-info "Lookup spec document must be an EDN map"
                    {:type :invalid-lookup-document
                     :lookup-spec-file lookup-spec-file})))
  (when-not (contains? lookup-doc :specs)
    (throw (ex-info "Unsupported lookup schema: expected top-level :specs"
                    {:type :unsupported-lookup-schema
                     :lookup-spec-file lookup-spec-file
                     :top-level-keys (vec (keys lookup-doc))})))
  (let [specs (:specs lookup-doc)]
    (when-not (sequential? specs)
      (throw (ex-info "Lookup :specs must be a collection"
                      {:type :invalid-lookup-specs
                       :lookup-spec-file lookup-spec-file})))
    (when (empty? specs)
      (throw (ex-info "Lookup :specs must not be empty"
                      {:type :empty-lookup-specs
                       :lookup-spec-file lookup-spec-file})))
    (doseq [[idx spec] (map-indexed vector specs)]
      (let [missing (if (map? spec)
                      (->> [:id :loop :segment-id :segment-ref :enabled? :lookup-kind]
                           (remove #(contains? spec %))
                           vec)
                      [:id :loop :segment-id :segment-ref :enabled? :lookup-kind])]
        (when (or (not (map? spec)) (seq missing))
          (throw (ex-info "Malformed lookup spec"
                          {:type :malformed-lookup-spec
                           :lookup-spec-file lookup-spec-file
                           :spec-index idx
                           :missing-fields missing})))))
    (let [key-fn (juxt :loop :segment-id :segment-ref)
          duplicate-keys (->> specs
                              (group-by key-fn)
                              (keep (fn [[k matching-specs]]
                                      (when (> (count matching-specs) 1) k)))
                              vec)]
      (when (seq duplicate-keys)
        (throw (ex-info "Duplicate lookup keys"
                        {:type :duplicate-lookup-keys
                         :lookup-spec-file lookup-spec-file
                         :duplicate-keys duplicate-keys}))))
    (assoc lookup-doc :specs (vec specs))))

(defn load-lookup-specs
  "Load and validate canonical lookup specs EDN. Throws a typed error on failure."
  [lookup-spec-file]
  (let [text (try
               (io/read-text lookup-spec-file)
               (catch :default cause
                 (throw (ex-info "Unable to read lookup spec file"
                                 {:type :lookup-file-error
                                  :lookup-spec-file lookup-spec-file}
                                 cause))))
        lookup-doc (try
                     (reader/read-string text)
                     (catch :default cause
                       (throw (ex-info "Unable to parse lookup spec EDN"
                                       {:type :lookup-parse-error
                                        :lookup-spec-file lookup-spec-file}
                                       cause))))]
    (validate-lookup-doc lookup-spec-file lookup-doc)))

(defn build-lookup-index
  "Build a lookup index keyed by [loop segment-id segment-ref]."
  [lookup-doc]
  (let [specs (:specs lookup-doc)]
    (reduce (fn [acc spec]
              (let [k [(:loop spec) (:segment-id spec) (:segment-ref spec)]]
                (assoc acc k spec)))
            {}
            specs)))

(defn find-lookup-spec
  "Resolve best lookup spec for a rule. Prefer exact loop match, fallback to segment+ref match."
  [lookup-index rule]
  (let [exact-k [(:loop-name rule) (:segment-id rule) (:segment-ref rule)]
        exact (get lookup-index exact-k)]
    (if exact
      exact
      (some (fn [[[_loop seg ref] spec]]
              (when (and (= seg (:segment-id rule))
                         (= ref (:segment-ref rule)))
                spec))
            lookup-index))))

(defn- resolve-lookup-spec-case
  [spec db-context]
  (if-not (seq (:cases spec))
    spec
    (when-let [matching-case
               (some (fn [{:keys [when] :as lookup-case}]
                       (let [{:keys [ref equals]} when
                             actual (str/trim (str (or (get (:refs db-context) ref) "")))]
                         (when (= actual (str equals)) lookup-case)))
                     (:cases spec))]
      (-> spec
          (dissoc :cases)
          (merge (dissoc matching-case :when))))))

(defn- default-lookup-executor
  "Default executor when no DB integration is provided yet."
  [_]
  {:executed? false
   :valid true
   :status :not-executed
   :reason :no-db-executor-configured})

(defn- evaluate-lookup
  [{:keys [lookup-index lookup-executor include-lookup-sql?]} rule value db-context]
  (cond
    (blankish? value)
    {:lookup-applied false
     :valid true
     :status :skipped-blank}

    (nil? lookup-index)
    {:lookup-applied false
     :valid true
     :status :no-lookup-index}

    :else
    (let [indexed-spec (find-lookup-spec lookup-index rule)
          spec (when indexed-spec (resolve-lookup-spec-case indexed-spec db-context))]
      (cond
        (nil? indexed-spec)
        {:lookup-applied false
         :valid true
         :status :no-spec}

        (nil? spec)
        {:lookup-applied false
         :valid true
         :status :condition-not-matched
         :lookup-spec-id (:id indexed-spec)
         :lookup-kind (:lookup-kind indexed-spec)}

        (not (true? (:enabled? spec)))
        {:lookup-applied true
         :valid true
         :status :spec-disabled
         :lookup-spec-id (:id spec)
         :lookup-kind (:lookup-kind spec)
         :reason (:disabled-reason spec)}

        :else
        (let [exec-fn (or lookup-executor default-lookup-executor)
            exec-result (or (exec-fn {:spec spec :rule rule :value value :db-context db-context}) {})
              executed? (boolean (:executed? exec-result))
              lookup-valid? (if (contains? exec-result :valid)
                              (boolean (:valid exec-result))
                              true)]
          (cond-> {:lookup-applied true
                   :valid lookup-valid?
                   :status (or (:status exec-result) (if executed? :executed :not-executed))
                   :executed? executed?
                   :lookup-spec-id (:id spec)
                   :lookup-kind (:lookup-kind spec)
                       :scope (:scope db-context)
                       :subscriber-index (:subscriber-index db-context)
                   :reason (:reason exec-result)}
            include-lookup-sql?
            (assoc :sql (get-in spec [:sql :exists]))))))))

(defn- run-rule-on-value
  "Run one compiled rule against a single element value and update stats/context."
  [context* stats* db-state* subscriber-progress* maybe-heartbeat-fn rule seg-id position value value-provided? lookup-state]
  (let [ref (to-ref seg-id position)
        _ (when-not (blankish? value)
            (swap! context* assoc ref value))
        _ (update-db-state! db-state* @context* rule seg-id position value)
        db-context (update (current-db-context db-state* rule) :refs merge @context*)
        result ((:validate rule) {:value value
                                  :segment-id seg-id
                                  :position position
                                  :context @context*})
        lookup-result (evaluate-lookup lookup-state rule value db-context)
        rule-valid? (boolean (:valid result))
        valid? (and rule-valid? (boolean (:valid lookup-result)))
            annotation (cond-> {:rule-id (:rule-id rule)
              :segment-ref (:segment-ref rule)
              :segment seg-id
              :name (:element-description rule)
              :loop-name (:loop-name rule)
              :loop-description (:segment-description rule)
              :value value
              :value-provided? value-provided?
              :valid valid?
              :rule-kind (:kind rule)
              :lookup lookup-result}
            (:loop-selection-strategy rule)
            (assoc :structural-loop-name (:structural-loop-name rule)
                   :structural-loop-path (:structural-loop-path rule)
                   :loop-selection-strategy (:loop-selection-strategy rule))

            (= :subscriber (:scope db-context))
            (assoc :subscriber-index (:subscriber-index db-context)
              :subscriber-ssn (:subscriber-ssn db-context)))]
    (swap! stats* update :total inc)
    (swap! stats* update (if valid? :passed :failed) inc)
    (when (:lookup-applied lookup-result)
      (swap! stats* update-in [:lookup :attempted] (fnil inc 0))
      (swap! stats* update-in [:lookup (if (:valid lookup-result) :passed :failed)] (fnil inc 0)))
    (when (not (:lookup-applied lookup-result))
      (swap! stats* update-in [:lookup :skipped] (fnil inc 0)))
    (swap! stats* update-in [:by-rule (:rule-id rule) :total] (fnil inc 0))
    (swap! stats* update-in [:by-rule (:rule-id rule) (if valid? :passed :failed)] (fnil inc 0))
    (when (= :subscriber (:scope db-context))
      (let [subscriber-index (:subscriber-index db-context)
            existing (or (get @subscriber-progress* subscriber-index)
                         (default-subscriber-progress subscriber-index (:subscriber-ssn db-context)))]
        (swap! subscriber-progress*
               assoc
               subscriber-index
               (update-subscriber-progress existing rule-valid? lookup-result db-context))
        (when maybe-heartbeat-fn
          (when-let [next-sp (get @subscriber-progress* subscriber-index)]
            (maybe-heartbeat-fn subscriber-index next-sp)))))
    (if valid?
      annotation
      (assoc annotation
             :invalid-description
             (pr-str {:rule result
                      :lookup lookup-result})))))

(defn collect-invalid-findings
  "Copy invalid annotations from a completed ISA tree into compact scalar maps."
  ([annotated-tree isa-index]
   (collect-invalid-findings annotated-tree isa-index false))
  ([annotated-tree isa-index isa-context-already-entered?]
   (let [findings* (atom [])
        current-isa-index* (atom (if isa-context-already-entered?
                                   isa-index
                                   (dec isa-index)))
        add-finding!
        (fn [annotation segment trail]
          (when (and (map? annotation) (false? (:valid annotation)))
            (let [ref (:segment-ref annotation)
                  reason (or (:invalid-description annotation)
                             (some-> annotation :lookup :reason pr-str)
                             "Validation failed")
                  locator-trail (conj trail (or ref segment "element"))]
              (swap! findings* conj
                (cond-> {:path (str "ISA[" @current-isa-index* "]/" (str/join "/" locator-trail))
                      :reason reason
                      :failed-value (:value annotation)
                      :value-provided (boolean (:value-provided? annotation))
                      :segment (or (:segment annotation) segment)
                      :ref ref
                      :name (:name annotation)
                      :loop-name (:loop-name annotation)
                      :loop-description (:loop-description annotation)
                      :locator-trail (vec locator-trail)
                      :subscriber-index (:subscriber-index annotation)
                            :subscriber-ssn (:subscriber-ssn annotation)
                            :isa-index @current-isa-index*}
                             (:loop-selection-strategy annotation)
                             (assoc :structural-loop-name (:structural-loop-name annotation)
                              :structural-loop-path (:structural-loop-path annotation)
                              :loop-selection-strategy (:loop-selection-strategy annotation)))))))
        walk
        (fn walk [node trail current-segment]
          (when (sequential? node)
            (let [tag (name (first node))
              _ (when (= tag "isa_data_segment")
                  (swap! current-isa-index* inc))
                  segment (cond
                            (= tag "data_segment") (or (extract-seg-id node) current-segment)
                    (= tag "raw_segment") (let [raw (if (map? (second node))
                              (nth node 2 nil)
                              (second node))]
                          (first (split-raw-segment raw)))
                            :else current-segment)
                  node-meta (second node)
                  next-trail (if (contains? #{"x12file" "functional_group" "transaction_set"
                                              "trans_body" "ins_subscriber"} tag)
                               (conj trail tag)
                               trail)]
              (when (and (= tag "raw_segment") (map? node-meta))
                (doseq [annotation (:element-validations node-meta)]
                  (add-finding! annotation segment next-trail)))
              (when (and (= tag "data_segment_unit") (map? node-meta))
                (add-finding! node-meta segment next-trail))
              (doseq [child (rest node)]
                (walk child next-trail segment)))))]
      (walk annotated-tree [] nil)
      @findings*)))

(defn- run-rule-preview
  "Run one rule without mutating global stats/context; returns [annotation next-context]."
  [context rule seg-id position value]
  (let [ref (to-ref seg-id position)
        next-context (if (blankish? value)
                       context
                       (assoc context ref value))
        result ((:validate rule) {:value value
                                  :segment-id seg-id
                                  :position position
                                  :context next-context})
        valid? (boolean (:valid result))
        annotation (cond-> {:rule-id (:rule-id rule)
                            :segment-ref (:segment-ref rule)
                            :valid valid?
                            :rule-kind (:kind rule)}
                     (not valid?)
                     (assoc :invalid-description (pr-str result)))]
    [annotation next-context]))

(defn- transmitted-rules
  "Map companion rules to their declared X12 element positions."
  [rules]
  (->> rules
       (sort-by :position)
       (map #(assoc % :edi-position (:position %)))
       vec))

(defn- choose-loop-aware-rules
  "Pick the first successful remaining loop definition in companion-guide order.
   If none succeeds, pick the best remaining definition without moving backward."
  [seg-id values seg-rules context eligible-loop-names structural-resolution]
  (let [rule-weight (fn [rule]
                      (case (:kind rule)
                        :cross-ref 4
                        :enum 3
                        :external-code-list 2
                        :pattern-hint 2
                        :literal 2
                        :placeholder 1
                        :open 0
                        1))
        groups (->> seg-rules
              (group-by (fn [r] [(:loop-name r) (:segment-description r)]))
              (sort-by key)
            (map (fn [[_ rs]] (transmitted-rules rs)))
            vec)
          eligible-order (into {} (map-indexed (fn [idx loop-name]
                            [loop-name idx])
                          eligible-loop-names))
          eligible-groups (if (seq eligible-loop-names)
                   (->> groups
                     (filter #(contains? eligible-order
                             (:loop-name (first %))))
                     (sort-by #(get eligible-order
                           (:loop-name (first %))))
                     vec)
                   groups)
          structural-loop-name (:loop-name structural-resolution)
          structural-groups (when structural-loop-name
                              (->> groups
                                   (filter #(= structural-loop-name
                                               (:loop-name (first %))))
                                   vec))
          candidate-groups (if (seq structural-groups)
                             structural-groups
                             eligible-groups)
          selection-strategy (if (seq structural-groups)
                               :structural-loop
                               :companion-order)]
    (if (<= (count candidate-groups) 1)
      (mapv #(assoc %
                    :structural-loop-name structural-loop-name
                    :structural-loop-path (:loop-path structural-resolution)
                    :loop-selection-strategy selection-strategy)
            (first candidate-groups))
      (let [scored
                 (map-indexed (fn [candidate-index rules]
                   (let [result
                         (reduce (fn [{:keys [ctx anns passed failed pass-weight fail-weight]} rule]
                                   (let [position (:position rule)
                                 value (nth values (dec (:edi-position rule)) nil)
                                         [ann next-ctx] (run-rule-preview ctx rule seg-id position value)
                                         w (rule-weight rule)]
                                     {:ctx next-ctx
                                      :anns (conj anns ann)
                                      :passed (if (:valid ann) (inc passed) passed)
                                      :failed (if (:valid ann) failed (inc failed))
                                      :pass-weight (if (:valid ann) (+ pass-weight w) pass-weight)
                                      :fail-weight (if (:valid ann) fail-weight (+ fail-weight w))}))
                                 {:ctx context :anns [] :passed 0 :failed 0 :pass-weight 0 :fail-weight 0}
                                 rules)]
                     {:rules rules
                      :passed (:passed result)
                      :failed (:failed result)
                      :score [(:pass-weight result)
                              (- (:fail-weight result))
                              (if (= :required (:segment-requirement (first rules))) 1 0)
                              (:passed result)
                              (- (:failed result))
                                (count rules)
                                (- candidate-index)]}))
                 candidate-groups)
                      discriminator-match
                      (some (fn [{:keys [rules] :as candidate}]
                          (let [rule (first rules)
                              position (:position rule)
                              value (nth values (dec (:edi-position rule)) nil)
                              [annotation _] (run-rule-preview context rule seg-id position value)]
                            (when (:valid annotation) candidate)))
                          scored)
                      best-scored (or discriminator-match
                                      (first scored))]
        (mapv #(assoc %
                :structural-loop-name structural-loop-name
                :structural-loop-path (:loop-path structural-resolution)
                :loop-selection-strategy selection-strategy)
              (:rules best-scored))))))

(defn- build-loop-order-by-segment
  "Build companion-guide loop order and identify loops containing multiple
   definitions of the same segment (e.g., REF variants in loop 2000)."
  [rules]
  (let [with-loop (filter (fn [{:keys [segment-id loop-name]}]
                            (and (not (blankish? segment-id))
                                 (not (blankish? loop-name))))
                          rules)
        order-map
        (reduce
         (fn [acc {:keys [segment-id loop-name]}]
           (let [existing (get acc segment-id [])]
             (if (some #(= % loop-name) existing)
               acc
               (assoc acc segment-id (conj existing loop-name)))))
         {}
         with-loop)
        repeatable-loops
        (->> with-loop
             (group-by (fn [{:keys [segment-id loop-name]}] [segment-id loop-name]))
             (reduce (fn [acc [[segment-id _] rs]]
                       (let [variant-count (->> rs (map :segment-description) distinct count)]
                         (if (> variant-count 1)
                           (update acc segment-id (fnil conj #{}) (:loop-name (first rs)))
                           acc)))
                     {}))]
    (into {}
          (map (fn [[segment-id order]]
                 [segment-id {:order order
                              :repeatable-loops (get repeatable-loops segment-id #{})}])
               order-map))))

(defn- eligible-loop-names
  "Return loops at or after the next allowed companion-guide position.
   Multi-variant loops may repeat; selection never moves to an earlier loop."
  [loop-order-by-seg loop-position seg-id]
  (let [{:keys [order repeatable-loops]} (get loop-order-by-seg seg-id)
        previous-position (get loop-position seg-id -1)]
    (when (seq order)
      (let [previous-loop (nth order previous-position nil)
            repeat-current? (contains? repeatable-loops previous-loop)
            next-position (if repeat-current?
                            previous-position
                            (min (inc previous-position) (dec (count order))))]
        (vec (drop next-position order))))))

(defn- record-loop-position
  [loop-position loop-order-by-seg seg-id active-rules]
  (let [{:keys [order]} (get loop-order-by-seg seg-id)
        selected-loop (:loop-name (first active-rules))
        selected-position (first (keep-indexed #(when (= %2 selected-loop) %1) order))]
    (if (some? selected-position)
      (assoc loop-position seg-id selected-position)
      loop-position)))

(defn validate-edi-parse-tree
  "Validate parsed EDI tree using compiled rules and annotate data units with :valid.
   Works with keyword-tag or string-tag parse trees."
  ([parse-tree rules]
   (validate-edi-parse-tree parse-tree rules {}))
  ([parse-tree rules opts]
   (let [rules-by-seg (group-by :segment-id rules)
      loop-order-by-seg (build-loop-order-by-segment rules)
      seg-occurrence* (atom {})
    loop-position* (atom {})
        context* (atom (or (:initial-context opts) {}))
        db-state* (atom {:commercial-refs (or (:initial-commercial-refs opts) {})
                         :subscribers []
                         :subscriber-index-offset (or (:subscriber-index-offset opts) 0)
                         :subscriber-ssns (vec (or (:subscriber-ssns opts)
                                                   (:subscriberSsns opts)
                                                   []))
                         :current-subscriber nil})
        subscriber-progress* (atom {})
        subscriber-statuses* (atom [])
        finalized-subscribers* (atom #{})
        heartbeat-attempts* (atom {})
        isa-index* (atom (if (:isa-context-already-entered? opts)
               (or (:isa-index opts) 1)
               (dec (or (:isa-index opts) 1))))
        direct-findings* (atom [])
        annotate-tree? (not (false? (:annotate-tree? opts)))
        finding-trail (vec (or (:finding-trail opts) []))
        record-invalid-finding!
        (fn [annotation segment]
          (when (and (:collect-invalid-findings-during-validation? opts)
                     (map? annotation)
                     (false? (:valid annotation)))
            (let [ref (:segment-ref annotation)
                  reason (or (:invalid-description annotation)
                             (some-> annotation :lookup :reason pr-str)
                             "Validation failed")
                  locator-trail (conj finding-trail (or ref segment "element"))]
              (swap! direct-findings* conj
                (cond-> {:path (str "ISA[" @isa-index* "]/" (str/join "/" locator-trail))
                      :reason reason
                      :failed-value (:value annotation)
                      :value-provided (boolean (:value-provided? annotation))
                      :segment (or (:segment annotation) segment)
                      :ref ref
                      :name (:name annotation)
                      :loop-name (:loop-name annotation)
                      :loop-description (:loop-description annotation)
                      :locator-trail locator-trail
                      :subscriber-index (:subscriber-index annotation)
                            :subscriber-ssn (:subscriber-ssn annotation)
                            :isa-index @isa-index*}
                             (:loop-selection-strategy annotation)
                             (assoc :structural-loop-name (:structural-loop-name annotation)
                              :structural-loop-path (:structural-loop-path annotation)
                              :loop-selection-strategy (:loop-selection-strategy annotation)))))))
        stats* (atom {:total 0 :passed 0 :failed 0 :by-rule {} :lookup {:attempted 0 :passed 0 :failed 0 :skipped 0}})
        started-ms (or (:started-ms opts) (now-ms))
        started-at (or (:started-at opts) (now-iso))
        run-id (or (:run-id opts) (:runId opts) (str (random-uuid)))
        heartbeat-every (normalize-heartbeat-every opts)
        total-subscribers (or (:total-subscribers opts)
                              (:totalSubscribers opts)
                              (count-ins-segments parse-tree)
                              0)
        db-validation-enabled? (true? (:db-validation-enabled? opts))
        structural-loop-resolver (:structural-loop-resolver opts)
        lookup-state {:lookup-index (:lookup-index opts)
                      :lookup-executor (:lookup-executor opts)
                      :include-lookup-sql? (true? (:include-lookup-sql? opts))}
        _ (when (not (false? (:initialize-progress-file? opts)))
          (init-progress-file! (or (:progress-output-file opts) (:progressOutputFile opts))))
          maybe-emit-heartbeat!
          (fn [subscriber-index subscriber-progress]
            (let [attempted (:db-attempted subscriber-progress)
              last-attempted (get @heartbeat-attempts* subscriber-index)]
          (when (and (> heartbeat-every 0)
                 (> attempted 0)
                 (zero? (mod attempted heartbeat-every))
                 (not= attempted last-attempted))
            (swap! heartbeat-attempts* assoc subscriber-index attempted)
            (let [safe-total (max 1 total-subscribers)
              processed-count (+ (or (:subscriber-index-offset opts) 0)
                                 (count @subscriber-statuses*))
              percent-complete (min 100
                    (js/Math.round
                     (* 100 (/ processed-count safe-total))))
              event {:event-type "subscriber-heartbeat"
                 :run-id run-id
                  :isa-index @isa-index*
                 :subscriber-index subscriber-index
                 :subscriber-ssn (:subscriber-ssn subscriber-progress)
                 :subscriber-key (build-subscriber-key subscriber-index (:subscriber-ssn subscriber-progress) run-id)
                 :status "db-validating"
                 :processed-subscribers processed-count
                 :total-subscribers total-subscribers
                 :percent-complete percent-complete
                 :elapsed-ms (- (now-ms) started-ms)
                 :started-at (:started-at subscriber-progress)
                 :structure {:total (:structure-total subscriber-progress)
                     :passed (:structure-passed subscriber-progress)
                     :failed (:structure-failed subscriber-progress)}
                 :db {:attempted (:db-attempted subscriber-progress)
                  :passed (:db-passed subscriber-progress)
                  :failed (:db-failed subscriber-progress)
                  :skipped (:db-skipped subscriber-progress)}}]
              (emit-progress! opts event)))))
        finalize-subscriber!
        (fn [subscriber-index]
          (when (and subscriber-index
                     (not (contains? @finalized-subscribers* subscriber-index)))
            (let [sp (or (get @subscriber-progress* subscriber-index)
                         (default-subscriber-progress subscriber-index nil))
                  status (subscriber-final-status sp db-validation-enabled?)
                  completed-at (now-iso)
                  processed-count (+ (or (:subscriber-index-offset opts) 0)
                                     (inc (count @subscriber-statuses*)))
                  safe-total (max 1 total-subscribers)
                  percent-complete (min 100
                                        (js/Math.round
                                         (* 100 (/ processed-count safe-total))))
                  event {:event-type "subscriber-completed"
                         :run-id run-id
                        :isa-index @isa-index*
                         :subscriber-index subscriber-index
                         :subscriber-ssn (:subscriber-ssn sp)
                         :subscriber-key (build-subscriber-key subscriber-index (:subscriber-ssn sp) run-id)
                         :status status
                         :processed-subscribers processed-count
                         :total-subscribers total-subscribers
                         :percent-complete percent-complete
                         :elapsed-ms (- (now-ms) started-ms)
                         :started-at (:started-at sp)
                         :completed-at completed-at
                         :structure {:total (:structure-total sp)
                                     :passed (:structure-passed sp)
                                     :failed (:structure-failed sp)}
                         :db {:attempted (:db-attempted sp)
                              :passed (:db-passed sp)
                              :failed (:db-failed sp)
                              :skipped (:db-skipped sp)}
                         :lookup-status-counts (:lookup-status-counts sp)
                         :failure-reasons (vec (remove nil? (:failure-reasons sp)))}]
              (swap! finalized-subscribers* conj subscriber-index)
              (swap! subscriber-statuses* conj event)
              (swap! subscriber-progress* dissoc subscriber-index)
              (swap! heartbeat-attempts* dissoc subscriber-index)
              (emit-progress! opts event)
              (parser/log-memory! (:log-memory? opts)
                                  "validate:after-subscriber-db-and-status"
                                  {:isa-index @isa-index*
                                   :subscriber-index subscriber-index
                                   :segment-count (reduce + 0 (vals @seg-occurrence*))
                                   :finding-count (:failed @stats*)
                                   :subscriber-status-count (count @subscriber-statuses*)
                                   :db-row-count (or (:db-row-count opts) 0)
                                   :db-cache-count (or (:db-cache-count opts) 0)}))))
        enrich
        (fn enrich [node]
          (if-not (sequential? node)
            node
            (do
              (when (tag= node "isa_data_segment")
                (when structural-loop-resolver
                  (structural-loop-resolver {:event :reset :scope :isa}))
                (reset! seg-occurrence* {})
                (reset! loop-position* {})
                (reset! context* (or (:initial-context opts) {}))
                (swap! db-state* assoc :commercial-refs (or (:initial-commercial-refs opts) {})))
              (cond
              (tag= node "data_segment")
              (let [seg-id (extract-seg-id node)
                    values (extract-unit-values node)
                    _ (when (= seg-id "INS")
                    (finalize-subscriber! (get-in @db-state* [:current-subscriber :index]))
                    (reset! seg-occurrence* {})
                    (reset! loop-position* {})
                    (reset! context* (:commercial-refs @db-state*)))
                    _ (swap! seg-occurrence* update seg-id (fnil inc 0))
                    seg-rules (sort-by :position (get rules-by-seg seg-id []))
                    eligible-loops (eligible-loop-names loop-order-by-seg @loop-position* seg-id)
                    structural-resolution (when structural-loop-resolver
                                            (structural-loop-resolver
                                             {:event :segment
                                              :segment-id seg-id
                                              :values values}))
                    active-rules (choose-loop-aware-rules seg-id values seg-rules @context* eligible-loops structural-resolution)
                    _ (swap! loop-position* record-loop-position
                             loop-order-by-seg seg-id active-rules)
                    children (vec (rest node))
                    unit-idxs (->> children
                                   (map-indexed vector)
                                   (filter (fn [[_ c]] (tag= c "data_segment_unit")))
                                   (map first)
                                   vec)
                    pos->rule (into {} (map (juxt :edi-position identity) active-rules))
                    new-children
                    (reduce
                     (fn [acc [pos unit-index]]
                       (let [position (inc pos)
                             unit (nth acc unit-index)
                             value (nth values pos nil)
                             rule (get pos->rule position)]
                         (if (nil? rule)
                           acc
                           (let [semantic-position (:position rule)
                                 annotation (run-rule-on-value context* stats* db-state* subscriber-progress* maybe-emit-heartbeat! rule seg-id semantic-position value true lookup-state)]
                             (record-invalid-finding! annotation seg-id)
                             (if annotate-tree?
                               (assoc acc unit-index (annotate-unit unit annotation))
                               acc)))))
                     children
                     (map-indexed vector unit-idxs))]
                (into [(first node)] (map enrich new-children)))

              (tag= node "raw_segment")
              (let [raw-text (second node)
                    [seg-id values] (split-raw-segment raw-text)
                  _ (when (= seg-id "INS")
                    (finalize-subscriber! (get-in @db-state* [:current-subscriber :index]))
                    (reset! seg-occurrence* {})
                    (reset! loop-position* {})
                    (reset! context* (:commercial-refs @db-state*)))
                    _ (swap! seg-occurrence* update seg-id (fnil inc 0))
                    seg-rules (sort-by :position (get rules-by-seg seg-id []))
                    eligible-loops (eligible-loop-names loop-order-by-seg @loop-position* seg-id)
                    structural-resolution (when structural-loop-resolver
                                            (structural-loop-resolver
                                             {:event :segment
                                              :segment-id seg-id
                                              :values values}))
                    active-rules (choose-loop-aware-rules seg-id values seg-rules @context* eligible-loops structural-resolution)
                    _ (swap! loop-position* record-loop-position
                             loop-order-by-seg seg-id active-rules)
                    annotations
                    (->> active-rules
                         (map (fn [rule]
                                (let [position (:position rule)
                            edi-position (:edi-position rule)
                            value (nth values (dec edi-position) nil)]
                          (run-rule-on-value context* stats* db-state* subscriber-progress* maybe-emit-heartbeat! rule seg-id position value (<= edi-position (count values)) lookup-state))))
                         vec)
                    _ (doseq [annotation annotations]
                      (record-invalid-finding! annotation seg-id))
                    segment-valid? (every? :valid annotations)]
                  (if (and annotate-tree? (seq annotations))
                  [(first node)
                   {:segment-id seg-id
                    :expected-loop (:loop-name (first active-rules))
                    :loop-name (:loop-name (first active-rules))
                    :loop-description (:segment-description (first active-rules))
                    :segment-requirement (:segment-requirement (first active-rules))
                    :validated-count (count annotations)
                    :valid segment-valid?
                    :element-validations annotations}
                   raw-text]
                  node))

              :else
              (let [annotated (into [(first node)] (map enrich (rest node)))]
                (when (tag= node "isa_data_segment")
                  (let [isa-index (swap! isa-index* inc)]
                    (parser/log-memory! (:log-memory? opts)
                                        "validate:after-isa-header-validation"
                                        {:isa-index isa-index
                                         :subscriber-index (get-in @db-state* [:current-subscriber :index])
                                         :segment-count (reduce + 0 (vals @seg-occurrence*))
                                         :finding-count (:failed @stats*)
                                         :subscriber-status-count (count @subscriber-statuses*)
                                         :db-row-count (or (:db-row-count opts) 0)
                                         :db-cache-count (or (:db-cache-count opts) 0)})))
                annotated)))))]
         (let [annotated-tree (enrich parse-tree)
             _ (finalize-subscriber! (get-in @db-state* [:current-subscriber :index]))
             subscriber-statuses @subscriber-statuses*]
           (parser/log-memory! (:log-memory? opts)
                               "validate:after-findings-merged"
                               {:isa-index @isa-index*
                                :subscriber-index (get-in @db-state* [:current-subscriber :index])
                                :segment-count (reduce + 0 (vals @seg-occurrence*))
                                :finding-count (:failed @stats*)
                                :subscriber-status-count (count subscriber-statuses)
                                :db-row-count (or (:db-row-count opts) 0)
                                :db-cache-count (or (:db-cache-count opts) 0)})
           {:annotated-tree (when annotate-tree? annotated-tree)
          :invalid-findings @direct-findings*
          :stats @stats*
          :context @context*
          :db-state @db-state*
          :subscriber-statuses subscriber-statuses
          :subscriber-progress-summary (build-subscriber-progress-summary subscriber-statuses)
          :run-id run-id
          :started-at started-at
          :elapsed-ms (- (now-ms) started-ms)}))))

(defn validate-parsed-json-text
  "Validate parsed EDI JSON text (array-based parse tree with string tags).
   Returns cljs map including annotated tree and summary stats."
  [parsed-json-text rules]
  (let [parsed (js/JSON.parse parsed-json-text)
        parse-tree (js->clj parsed)]
    (validate-edi-parse-tree parse-tree rules)))

(defn- collect-lookup-outcomes
  "Collect flattened lookup outcomes from annotated tree in traversal order."
  [annotated-tree]
  (let [acc* (atom [])
        walk (fn walk [node]
               (when (sequential? node)
                 (let [meta (second node)]
                   (when (and (map? meta)
                              (vector? (:element-validations meta)))
                     (doseq [ev (:element-validations meta)]
                       (let [lookup (:lookup ev)]
                         (when (map? lookup)
                           (swap! acc* conj {:segment-ref (:segment-ref ev)
                                             :rule-id (:rule-id ev)
                                             :status (:status lookup)
                                             :valid (:valid lookup)
                                             :scope (:scope lookup)
                                             :subscriber-index (:subscriber-index lookup)}))))))
                 (doseq [c (rest node)]
                   (walk c))))]
    (walk annotated-tree)
    @acc*))

(defn- compare-lookup-outcomes
  "Compare two flattened lookup-outcome vectors and summarize mismatches."
  [legacy-outcomes single-outcomes]
  (let [n (min (count legacy-outcomes) (count single-outcomes))
        pairs (map vector (take n legacy-outcomes) (take n single-outcomes))
        mismatches (->> pairs
                        (keep-indexed
                         (fn [idx [l s]]
                           (when (or (not= (:status l) (:status s))
                                     (not= (:valid l) (:valid s)))
                             {:index idx
                              :segment-ref (:segment-ref l)
                              :rule-id (:rule-id l)
                              :subscriber-index (:subscriber-index l)
                              :legacy-status (:status l)
                              :single-status (:status s)
                              :legacy-valid (:valid l)
                              :single-valid (:valid s)})))
                        vec)
        mismatch-by-segment (->> mismatches
                                 (group-by :segment-ref)
                                 (into {}
                                       (map (fn [[k vs]] [k (count vs)]))))
        mismatch-by-rule (->> mismatches
                              (group-by :rule-id)
                              (into {}
                                    (map (fn [[k vs]] [k (count vs)]))))]
    {:legacy-count (count legacy-outcomes)
     :single-count (count single-outcomes)
     :compared-count n
     :length-delta (- (count single-outcomes) (count legacy-outcomes))
     :mismatch-count (count mismatches)
     :mismatch-count-by-segment-ref mismatch-by-segment
     :mismatch-count-by-rule-id mismatch-by-rule
     :mismatch-samples (vec (take 25 mismatches))}))

(defn- merge-validation-stats
  [left right]
  {:total (+ (or (:total left) 0) (or (:total right) 0))
   :passed (+ (or (:passed left) 0) (or (:passed right) 0))
   :failed (+ (or (:failed left) 0) (or (:failed right) 0))
   :lookup (merge-with +
                       {:attempted 0 :passed 0 :failed 0 :skipped 0}
                       (:lookup left)
                       (:lookup right))
   :by-rule (merge-with (fn [a b] (merge-with + a b))
                        (or (:by-rule left) {})
                        (or (:by-rule right) {}))})

(defn- merge-prefetch-summary
  [summary prefetch-data]
  (if-not prefetch-data
    summary
    {:ok (and (not (false? (:ok summary))) (:ok prefetch-data))
     :ssn-count (+ (or (:ssn-count summary) 0) (or (:ssn-count prefetch-data) 0))
     :row-count (+ (or (:row-count summary) 0) (or (:row-count prefetch-data) 0))
     :spec-count (max (or (:spec-count summary) 0) (or (:spec-count prefetch-data) 0))
     :error (or (:error summary) (:error prefetch-data))}))

(defn- merge-comparison-summary
  [summary comparison]
  (cond
    (nil? comparison) summary
    (nil? summary) comparison
    :else
    {:legacy-count (+ (:legacy-count summary) (:legacy-count comparison))
     :single-count (+ (:single-count summary) (:single-count comparison))
     :compared-count (+ (:compared-count summary) (:compared-count comparison))
     :length-delta (+ (:length-delta summary) (:length-delta comparison))
     :mismatch-count (+ (:mismatch-count summary) (:mismatch-count comparison))
     :mismatch-count-by-segment-ref
     (merge-with + (:mismatch-count-by-segment-ref summary)
                 (:mismatch-count-by-segment-ref comparison))
     :mismatch-count-by-rule-id
     (merge-with + (:mismatch-count-by-rule-id summary)
                 (:mismatch-count-by-rule-id comparison))
     :mismatch-samples (vec (take 25 (concat (:mismatch-samples summary)
                                             (:mismatch-samples comparison))))}))

(defn- run-rule-harness-isa-streaming
  [companion-csv edi-file opts]
  (when (or (not (false? (:include-parsed? opts)))
            (not (false? (:include-enriched? opts))))
    (throw (ex-info "Streaming validation requires includeParsed=false and includeEnriched=false"
                    {:type :streaming-tree-output-not-supported})))
  (let [{:keys [rules model]} (parse-companion-csv->rules companion-csv)
        db-enabled? (or (true? (:db-validation? opts))
                        (= "true" (str/lower-case (str (or (env-get "DB_VALIDATION") ""))))
                        (= "1" (str (or (env-get "DB_VALIDATION") ""))))
        lookup-spec-file (or (:lookup-spec-file opts) "save/companion-db-lookups.edn")
        lookup-requested? (or db-enabled? (contains? opts :lookup-spec-file))
        lookup-doc (when lookup-requested? (load-lookup-specs lookup-spec-file))
        lookup-index (when lookup-doc (build-lookup-index lookup-doc))
        db-config (when db-enabled? (resolve-db-config opts))
        single-query? (true? (:single-query-db-validation? opts))
        compare? (true? (:compare-single-query-vs-legacy? opts))
        legacy-executor (when db-enabled? (make-oracle-lookup-executor opts))
        run-id (or (:run-id opts) (:runId opts) (str (random-uuid)))
        started-ms (now-ms)
        started-at (now-iso)
        progress-opts (assoc opts :run-id run-id)
        initial {:stats {:total 0
                         :passed 0
                         :failed 0
                         :lookup {:attempted 0 :passed 0 :failed 0 :skipped 0}
                         :by-rule {}}
                 :subscriber-statuses []
                 :invalid-findings []
                 :subscriber-count 0
                 :isa-count 0
                 :prefetch-summary nil
                 :comparison nil}
        _ (init-progress-file! (or (:progress-output-file opts) (:progressOutputFile opts)))
        result
        (io/reduce-isa-file
         edi-file
         (select-keys opts [:read-buffer-size])
         (fn [acc {:keys [isa-index segment-count text]}]
           (emit-progress! progress-opts
                           {:event-type "isa-started"
                            :run-id run-id
                            :isa-index isa-index
                            :processed-isas (dec isa-index)
                            :total-isas nil
                            :elapsed-ms (- (now-ms) started-ms)})
           (parser/log-memory! (:log-memory? opts) "streaming:isa-detected"
                               {:isa-index isa-index
                                :processed-isa-count (dec isa-index)
                                :segment-count segment-count
                                :finding-count (count (:invalid-findings acc))
                                :subscriber-status-count (count (:subscriber-statuses acc))})
           (let [parse-tree (parser/parse-x12-text text (select-keys opts [:log-memory?]))
                 _ (emit-progress! progress-opts
                                   {:event-type "isa-parsed"
                                    :run-id run-id
                                    :isa-index isa-index
                                    :processed-isas (dec isa-index)
                                    :total-isas nil
                                    :segment-count segment-count
                                    :elapsed-ms (- (now-ms) started-ms)})
                 subscriber-ssns (extract-subscriber-ssns-from-parse-tree parse-tree)
                 prefetch-data (when (and db-enabled?
                                          single-query?
                                          db-config
                                          (:valid? db-config)
                                          lookup-doc)
                                 (load-subscriber-prefetch-data db-config parse-tree lookup-doc))
                 single-executor (when (and db-enabled? single-query? prefetch-data)
                                   (make-single-query-subscriber-executor opts prefetch-data))
                 effective-executor
                 (or (:lookup-executor opts)
                     (when db-enabled?
                       (if single-executor
                         (fn [{:keys [db-context] :as input}]
                           (if (= :subscriber (:scope db-context))
                             (single-executor input)
                             (legacy-executor input)))
                         legacy-executor)))
                 validation (validate-edi-parse-tree
                             parse-tree
                             rules
                             {:lookup-index lookup-index
                              :lookup-executor effective-executor
                              :include-lookup-sql? (:include-lookup-sql? opts)
                              :db-validation-enabled? db-enabled?
                              :subscriber-ssns subscriber-ssns
                              :subscriber-index-offset (:subscriber-count acc)
                              :total-subscribers (+ (:subscriber-count acc)
                                                    (count subscriber-ssns))
                              :isa-index isa-index
                              :initialize-progress-file? false
                              :log-memory? (:log-memory? opts)
                              :db-row-count (or (:row-count prefetch-data) 0)
                              :db-cache-count (count (or (:values prefetch-data) {}))
                              :run-id run-id
                              :progress-output-file (or (:progress-output-file opts)
                                                        (:progressOutputFile opts))
                              :heartbeat-every-db-attempts (:heartbeat-every-db-attempts opts)
                              :on-progress (or (:on-progress opts) (:onProgress opts))})
                 annotated-tree (:annotated-tree validation)
                 findings (collect-invalid-findings annotated-tree isa-index)
                 statuses (:subscriber-statuses validation)
                 subscriber-count (+ (:subscriber-count acc) (count statuses))
                 comparison
                 (when (and db-enabled? single-query? compare? legacy-executor effective-executor)
                   (let [legacy-validation
                         (validate-edi-parse-tree
                          parse-tree rules
                          {:lookup-index lookup-index
                           :lookup-executor legacy-executor
                           :include-lookup-sql? (:include-lookup-sql? opts)
                           :db-validation-enabled? db-enabled?
                           :subscriber-ssns subscriber-ssns
                           :subscriber-index-offset (:subscriber-count acc)
                           :isa-index isa-index
                           :initialize-progress-file? false
                           :run-id (str run-id "-legacy")})]
                     (compare-lookup-outcomes
                      (collect-lookup-outcomes (:annotated-tree legacy-validation))
                      (collect-lookup-outcomes annotated-tree))))
                 next-acc (-> acc
                              (update :stats merge-validation-stats (:stats validation))
                              (update :subscriber-statuses into statuses)
                              (update :invalid-findings into findings)
                              (assoc :subscriber-count subscriber-count
                                     :isa-count isa-index)
                              (update :prefetch-summary merge-prefetch-summary prefetch-data)
                                (update :comparison merge-comparison-summary comparison))]
             (parser/log-memory! (:log-memory? opts) "streaming:compact-findings-extracted"
                                 {:isa-index isa-index
                                  :processed-isa-count isa-index
                                  :segment-count segment-count
                                  :finding-count (count (:invalid-findings next-acc))
                                  :subscriber-status-count (count (:subscriber-statuses next-acc))
                                  :db-row-count (or (:row-count prefetch-data) 0)
                                  :db-cache-count (count (or (:values prefetch-data) {}))})
             (emit-progress! progress-opts
                             {:event-type "isa-completed"
                              :run-id run-id
                              :isa-index isa-index
                              :processed-isas isa-index
                              :total-isas nil
                              :subscriber-count (count statuses)
                              :segment-count segment-count
                              :elapsed-ms (- (now-ms) started-ms)})
             (parser/log-memory! (:log-memory? opts) "streaming:isa-references-ready-for-release"
                                 {:isa-index isa-index
                                  :processed-isa-count isa-index
                                  :segment-count segment-count
                                  :finding-count (count (:invalid-findings next-acc))
                                  :subscriber-status-count (count (:subscriber-statuses next-acc))})
             next-acc))
         initial)
        stats (:stats result)
        statuses (:subscriber-statuses result)
        elapsed-ms (- (now-ms) started-ms)
        report {:legend-count (count (:legend model))
                :loop-count (count (:loops model))
                :element-row-count (count (:elements model))
                :rule-count (count rules)
                :rule-kind-counts (frequencies (map :kind rules))
                :validation stats
                :context-keys nil
                :lookup-spec-file lookup-spec-file
                :lookup-spec-count (count (:specs lookup-doc))
                :lookup-enabled-spec-count (count (filter :enabled? (:specs lookup-doc)))
                :lookup-summary (:lookup stats)
                :db-validation-enabled db-enabled?
                :single-query-db-validation-enabled
                (boolean (and db-enabled? single-query? (:prefetch-summary result)))
                :db-env-name (:env-name db-config)
                :single-query-prefetch-summary (:prefetch-summary result)
                :single-query-legacy-compare
                (when-let [comparison (:comparison result)]
                  (assoc comparison :enabled true :performed true))
                :streaming true
                :isa-count (:isa-count result)
                :run-id run-id
                :started-at started-at
                :elapsed-ms elapsed-ms
                :subscriber-statuses statuses
                :subscriber-progress-summary (build-subscriber-progress-summary statuses)
                :subscriber-count (:subscriber-count result)}]
    (parser/log-memory! (:log-memory? opts) "streaming:run-result-constructed"
                        {:processed-isa-count (:isa-count result)
                         :finding-count (count (:invalid-findings result))
                         :subscriber-status-count (count statuses)})
    {:report report
     :rules rules
     :invalid-findings (:invalid-findings result)
     :parsed-tree nil
     :annotated-tree nil}))

(defn- run-rule-harness-streaming
  [companion-csv edi-file opts]
  (when (or (not (false? (:include-parsed? opts)))
            (not (false? (:include-enriched? opts))))
    (throw (ex-info "Streaming validation requires includeParsed=false and includeEnriched=false"
                    {:type :streaming-tree-output-not-supported})))
  (let [{:keys [rules model]} (parse-companion-csv->rules companion-csv)
        collect-findings? (not (false? (:collect-invalid-findings? opts)))
    collect-subscriber-statuses? (not (false? (:collect-subscriber-statuses? opts)))
      subscriber-batch-size (or (:subscriber-batch-size opts)
                (:subscriberBatchSize opts)
                1)
      _ (when-not (and (number? subscriber-batch-size)
           (js/Number.isInteger subscriber-batch-size)
           (pos? subscriber-batch-size))
      (throw (ex-info "subscriberBatchSize must be a positive integer"
              {:type :invalid-subscriber-batch-size
               :subscriber-batch-size subscriber-batch-size})))
        on-finding-batch (or (:on-finding-batch opts) (:onFindingBatch opts))
        finding-output-file (or (:finding-output-file opts) (:findingOutputFile opts))
        finding-batch-size (max 1 (or (:finding-batch-size opts)
                                      (:findingBatchSize opts)
                                      250))
        _ (when (and (not collect-findings?)
                     (nil? on-finding-batch)
                     (blankish? finding-output-file))
            (throw (ex-info "Streaming findings require collection, a callback, or an NDJSON file"
                            {:type :missing-finding-destination})))
        _ (when-not (blankish? finding-output-file)
            (.writeFileSync (js/require "fs") finding-output-file "" "utf8"))
        deliver-findings!
        (fn [findings]
          (doseq [batch (partition-all finding-batch-size findings)]
            (let [batch (vec batch)]
              (when on-finding-batch
                (on-finding-batch (clj->js batch)))
              (when-not (blankish? finding-output-file)
                (.appendFileSync
                 (js/require "fs")
                 finding-output-file
                 (str (str/join "\n" (map #(js/JSON.stringify (clj->js %)) batch)) "\n")
                 "utf8")))))
        db-enabled? (or (true? (:db-validation? opts))
                        (= "true" (str/lower-case (str (or (env-get "DB_VALIDATION") ""))))
                        (= "1" (str (or (env-get "DB_VALIDATION") ""))))
        lookup-spec-file (or (:lookup-spec-file opts) "save/companion-db-lookups.edn")
        lookup-requested? (or db-enabled? (contains? opts :lookup-spec-file))
        lookup-doc (when lookup-requested? (load-lookup-specs lookup-spec-file))
        lookup-index (when lookup-doc (build-lookup-index lookup-doc))
        db-config (when db-enabled? (resolve-db-config opts))
        single-query? (true? (:single-query-db-validation? opts))
        compare? (true? (:compare-single-query-vs-legacy? opts))
        legacy-executor (when db-enabled? (make-oracle-lookup-executor opts))
        ins-parser-instance (:ins-parser (parser/create-parsers))
        run-id (or (:run-id opts) (:runId opts) (str (random-uuid)))
        started-ms (now-ms)
        started-at (now-iso)
        total-subscribers
        (or (:total-subscribers opts)
            (:totalSubscribers opts)
            (io/reduce-ins-file
             edi-file
             (select-keys opts [:read-buffer-size])
             (fn [total unit]
               (if (= :subscriber (:type unit)) (inc total) total))
             0))
        progress-opts (assoc opts :run-id run-id)
        validation-opts
        (fn [state isa-index executor subscriber-ssns prefetch-data]
          {:lookup-index lookup-index
           :lookup-executor executor
           :include-lookup-sql? (:include-lookup-sql? opts)
           :db-validation-enabled? db-enabled?
           :subscriber-ssns subscriber-ssns
           :subscriber-index-offset (:subscriber-count state)
           :total-subscribers total-subscribers
           :isa-index isa-index
           :isa-context-already-entered? true
           :initial-context (:commercial-context state)
           :initial-commercial-refs (:commercial-refs state)
           :initialize-progress-file? false
           :log-memory? (:log-memory? opts)
           :db-row-count (or (:row-count prefetch-data) 0)
           :db-cache-count (count (or (:values prefetch-data) {}))
           :annotate-tree? false
           :collect-invalid-findings-during-validation? true
           :run-id run-id
           :started-ms started-ms
           :started-at started-at
           :progress-output-file (or (:progress-output-file opts)
                                     (:progressOutputFile opts))
           :heartbeat-every-db-attempts (:heartbeat-every-db-attempts opts)
           :on-progress (or (:on-progress opts) (:onProgress opts))})
        merge-validation
        (fn [state validation findings]
          (let [statuses (:subscriber-statuses validation)]
            (deliver-findings! findings)
            (cond-> (-> state
                        (update :stats merge-validation-stats (:stats validation))
                        (update :subscriber-progress-summary
                                merge-subscriber-progress-summary statuses))
              collect-subscriber-statuses? (update :subscriber-statuses into statuses)
              collect-findings? (update :invalid-findings into findings))))
        validate-context
        (fn [state]
          (if (empty? (:pending-context state))
            state
            (let [isa-index (:current-isa-index state)
                  body-segments (remove
                                 (fn [segment]
                                   (contains? #{"ISA" "IEA" "GS" "GE" "ST" "SE"}
                                              (first (str/split segment #"\*" 2))))
                                 (:pending-context state))
                  parse-tree [:x12file
                              [:functional_group
                               [:transaction_set
                                (into [:trans_body]
                                      (map (fn [segment] [:raw_segment segment])
                                           body-segments))]]]
                  executor (or (:lookup-executor opts)
                               (when db-enabled? legacy-executor))
                  validation (validate-edi-parse-tree
                              parse-tree rules
                        (assoc (validation-opts state isa-index executor [] nil)
                          :finding-trail
                          ["x12file" "functional_group"
                           "transaction_set" "trans_body"]))
                      findings (:invalid-findings validation)]
              (-> (merge-validation state validation findings)
                  (assoc :commercial-context (:context validation)
                         :commercial-refs (get-in validation [:db-state :commercial-refs])
                         :pending-context [])))))
          validate-subscriber-batch
          (fn [state units]
            (let [{:keys [isa-index transaction-index]} (first units)
              subscriber-index (:subscriber-index (last units))
              segment-count (reduce + (map :segment-count units))
                parse-tree [:x12file
                            [:functional_group
                             [:transaction_set
                (into [:trans_body]
                  (map #(parser/parse-ins-text
                     (:text %)
                     {:ins-parser ins-parser-instance})
                       units))]]]
                subscriber-ssns (extract-subscriber-ssns-from-parse-tree parse-tree)
                prefetch-data (when (and db-enabled?
                                         single-query?
                                         db-config
                                         (:valid? db-config)
                                         lookup-doc)
                                (load-subscriber-prefetch-data db-config parse-tree lookup-doc))
                single-executor (when (and db-enabled? single-query? prefetch-data)
                                  (make-single-query-subscriber-executor opts prefetch-data))
                effective-executor
                (or (:lookup-executor opts)
                    (when db-enabled?
                      (if single-executor
                        (fn [{:keys [db-context] :as input}]
                          (if (= :subscriber (:scope db-context))
                            (single-executor input)
                            (legacy-executor input)))
                        legacy-executor)))
                validation (validate-edi-parse-tree
                            parse-tree rules
                            (assoc (validation-opts state isa-index effective-executor
                                                    subscriber-ssns prefetch-data)
                                   :annotate-tree? compare?
                                   :finding-trail
                                   ["x12file" "functional_group" "transaction_set"
                                    "trans_body" "ins_subscriber"]))
                findings (:invalid-findings validation)
                comparison
                (when (and db-enabled? single-query? compare?
                           legacy-executor effective-executor)
                  (let [legacy-validation
                        (validate-edi-parse-tree
                         parse-tree rules
                         (assoc (validation-opts state isa-index legacy-executor
                               subscriber-ssns nil)
                          :annotate-tree? true
                              :collect-invalid-findings-during-validation? false
                              :on-progress nil
                              :progress-output-file nil))]
                    (compare-lookup-outcomes
                     (collect-lookup-outcomes (:annotated-tree legacy-validation))
                     (collect-lookup-outcomes (:annotated-tree validation)))))
                next-state
                (-> (merge-validation state validation findings)
                    (update :subscriber-count + (count units))
                    (update :prefetch-summary merge-prefetch-summary prefetch-data)
                    (update :comparison merge-comparison-summary comparison))]
            (parser/log-memory! (:log-memory? opts)
                                "streaming:subscriber-batch-references-ready-for-release"
                                {:isa-index isa-index
                                 :transaction-index transaction-index
                                 :subscriber-index subscriber-index
                                 :subscriber-batch-count (count units)
                                 :segment-count segment-count
                                 :finding-count (count (:invalid-findings next-state))
                                 :subscriber-status-count (count (:subscriber-statuses next-state))
                                 :db-row-count (or (:row-count prefetch-data) 0)
                                 :db-cache-count (count (or (:values prefetch-data) {}))})
            next-state))
        flush-subscriber-batch
        (fn [state]
          (if (empty? (:pending-subscribers state))
            state
            (-> (validate-subscriber-batch state (:pending-subscribers state))
                (assoc :pending-subscribers []))))
        initial {:stats {:total 0
                         :passed 0
                         :failed 0
                         :lookup {:attempted 0 :passed 0 :failed 0 :skipped 0}
                         :by-rule {}}
                 :subscriber-statuses []
                 :subscriber-progress-summary {:total 0
                                               :completed-passed 0
                                               :completed-failed 0
                                               :completed-partial 0}
                 :invalid-findings []
                 :subscriber-count 0
                 :isa-count 0
                 :current-isa-index nil
                 :current-isa-segment-count 0
                 :commercial-context {}
                 :commercial-refs {}
                 :pending-context []
                 :pending-subscribers []
                 :prefetch-summary nil
                 :comparison nil}
        _ (init-progress-file! (or (:progress-output-file opts) (:progressOutputFile opts)))
        reduced
        (io/reduce-ins-file
         edi-file
         (select-keys opts [:read-buffer-size])
         (fn [state unit]
           (case (:type unit)
             :subscriber
             (let [state (if (empty? (:pending-subscribers state))
                           (validate-context state)
                           state)
                   state (-> state
                             (update :current-isa-segment-count + (:segment-count unit))
                             (update :pending-subscribers conj unit))]
               (if (>= (count (:pending-subscribers state)) subscriber-batch-size)
                 (flush-subscriber-batch state)
                 state))

             :context
             (let [state (flush-subscriber-batch state)
                   isa-index (:isa-index unit)
                   segment-id (:segment-id unit)
                   state (if (= segment-id "ISA")
                           (do
                             (emit-progress! progress-opts
                                             {:event-type "isa-started"
                                              :run-id run-id
                                              :isa-index isa-index
                                              :processed-isas (dec isa-index)
                                              :total-isas nil
                                              :elapsed-ms (- (now-ms) started-ms)})
                             (emit-progress! progress-opts
                                             {:event-type "isa-parsed"
                                              :run-id run-id
                                              :isa-index isa-index
                                              :processed-isas (dec isa-index)
                                              :total-isas nil
                                              :segment-count nil
                                              :elapsed-ms (- (now-ms) started-ms)})
                             (assoc state
                                    :current-isa-index isa-index
                                    :current-isa-segment-count 0
                                    :isa-subscriber-start (:subscriber-count state)
                                    :commercial-context {}
                                    :commercial-refs {}))
                           state)
                   state (-> state
                             (update :pending-context conj (:segment unit))
                             (update :current-isa-segment-count inc))]
               (if (= segment-id "IEA")
                 (let [state (validate-context state)
                       segment-total (:current-isa-segment-count state)]
                   (emit-progress! progress-opts
                                   {:event-type "isa-completed"
                                    :run-id run-id
                                    :isa-index isa-index
                                    :processed-isas isa-index
                                    :total-isas nil
                                    :subscriber-count (- (:subscriber-count state)
                                                         (:isa-subscriber-start state))
                                    :segment-count segment-total
                                    :elapsed-ms (- (now-ms) started-ms)})
                   (assoc state :isa-count isa-index))
                 state))

             state))
         initial)
        result (-> reduced flush-subscriber-batch validate-context)
        stats (:stats result)
        statuses (:subscriber-statuses result)
        elapsed-ms (- (now-ms) started-ms)
        report {:legend-count (count (:legend model))
                :loop-count (count (:loops model))
                :element-row-count (count (:elements model))
                :rule-count (count rules)
                :rule-kind-counts (frequencies (map :kind rules))
                :validation stats
                :context-keys nil
                :lookup-spec-file lookup-spec-file
                :lookup-spec-count (count (:specs lookup-doc))
                :lookup-enabled-spec-count (count (filter :enabled? (:specs lookup-doc)))
                :lookup-summary (:lookup stats)
                :db-validation-enabled db-enabled?
                :single-query-db-validation-enabled
                (boolean (and db-enabled? single-query? (:prefetch-summary result)))
                :db-env-name (:env-name db-config)
                :single-query-prefetch-summary (:prefetch-summary result)
                :single-query-legacy-compare
                (when-let [comparison (:comparison result)]
                  (assoc comparison :enabled true :performed true))
                :streaming true
                :subscriber-bounded-streaming true
                :subscriber-batch-size subscriber-batch-size
                :invalid-findings-collected collect-findings?
                :subscriber-statuses-collected collect-subscriber-statuses?
                :finding-output-file finding-output-file
                :isa-count (:isa-count result)
                :run-id run-id
                :started-at started-at
                :elapsed-ms elapsed-ms
                :subscriber-statuses statuses
                :subscriber-progress-summary (:subscriber-progress-summary result)
                :subscriber-count (:subscriber-count result)}]
    (parser/log-memory! (:log-memory? opts) "streaming:run-result-constructed"
                        {:processed-isa-count (:isa-count result)
                         :finding-count (count (:invalid-findings result))
                         :subscriber-status-count (count statuses)})
    {:report report
     :rules rules
     :invalid-findings (:invalid-findings result)
     :parsed-tree nil
     :annotated-tree nil}))

(defn run-rule-harness
  "Test harness: parse companion CSV -> compile rules -> parse an EDI file -> validate.
  Returns parsed tree, annotated tree, and summary focused on validation coverage."
  ([companion-csv edi-file]
   (run-rule-harness companion-csv edi-file {}))
  ([companion-csv edi-file opts]
    (println "[run-rule-harness]")
    (if (true? (:streaming? opts))
      (run-rule-harness-streaming companion-csv edi-file opts)
      (let [{:keys [rules model]} (parse-companion-csv->rules companion-csv)
       db-enabled? (or (true? (:db-validation? opts))
                       (= "true" (str/lower-case (str (or (env-get "DB_VALIDATION") ""))))
                       (= "1" (str (or (env-get "DB_VALIDATION") ""))))
       lookup-spec-file (or (:lookup-spec-file opts) "save/companion-db-lookups.edn")
       lookup-requested? (or db-enabled? (contains? opts :lookup-spec-file))
       lookup-doc (when lookup-requested? (load-lookup-specs lookup-spec-file))
       lookup-index (when lookup-doc (build-lookup-index lookup-doc))
       db-config (when db-enabled? (resolve-db-config opts))
       single-query-db-validation? (true? (:single-query-db-validation? opts))
       compare-single-query-vs-legacy? (true? (:compare-single-query-vs-legacy? opts))
      _ (parser/log-memory! (:log-memory? opts) "run-rule-harness:before-edi-read" {:file edi-file})
       parse-tree (parser/parse-x12-full edi-file (select-keys opts [:log-memory?]))
      _ (parser/log-memory! (:log-memory? opts) "run-rule-harness:after-full-parse" nil)
       subscriber-ssns (extract-subscriber-ssns-from-parse-tree parse-tree)
       prefetch-data (when (and db-enabled?
                                single-query-db-validation?
                                db-config
                                (:valid? db-config)
                                lookup-doc)
                       (load-subscriber-prefetch-data db-config parse-tree lookup-doc))
                  _ (parser/log-memory! (:log-memory? opts)
                         "run-rule-harness:after-db-prefetch"
                         {:db-row-count (or (:row-count prefetch-data) 0)
                          :db-cache-count (count (or (:values prefetch-data) {}))})
       legacy-executor (when db-enabled? (make-oracle-lookup-executor opts))
       single-executor (when (and db-enabled?
                                  single-query-db-validation?
                                  prefetch-data)
                         (make-single-query-subscriber-executor opts prefetch-data))
         legacy-only-executor (or (:lookup-executor opts)
                                  (when db-enabled? legacy-executor))
       effective-lookup-executor
       (or (:lookup-executor opts)
           (when db-enabled?
             (if single-executor
               (fn [{:keys [db-context] :as in}]
                 (if (= :subscriber (:scope db-context))
                   (single-executor in)
                   (legacy-executor in)))
               legacy-executor)))
             {:keys [annotated-tree stats context db-state subscriber-statuses subscriber-progress-summary run-id started-at elapsed-ms]} (validate-edi-parse-tree parse-tree rules
                          {:lookup-index lookup-index
                           :lookup-executor effective-lookup-executor
               :include-lookup-sql? (:include-lookup-sql? opts)
               :db-validation-enabled? db-enabled?
               :structural-loop-resolver (:structural-loop-resolver opts)
               :subscriber-ssns subscriber-ssns
               :log-memory? (:log-memory? opts)
               :db-row-count (or (:row-count prefetch-data) 0)
               :db-cache-count (count (or (:values prefetch-data) {}))
               :run-id (or (:run-id opts) (:runId opts))
               :progress-output-file (or (:progress-output-file opts) (:progressOutputFile opts))
               :on-progress (or (:on-progress opts) (:onProgress opts))})
             comparison (when (and db-enabled?
                       single-query-db-validation?
                       compare-single-query-vs-legacy?
                       legacy-only-executor
                       effective-lookup-executor)
                  (let [{legacy-tree :annotated-tree}
                    (validate-edi-parse-tree parse-tree rules
                             {:lookup-index lookup-index
                              :lookup-executor legacy-only-executor
                              :include-lookup-sql? (:include-lookup-sql? opts)
                              :db-validation-enabled? db-enabled?
                              :subscriber-ssns subscriber-ssns
                              :run-id (str (or (:run-id opts) (:runId opts) "run") "-legacy")})
                    legacy-outcomes (collect-lookup-outcomes legacy-tree)
                    single-outcomes (collect-lookup-outcomes annotated-tree)]
                    (compare-lookup-outcomes legacy-outcomes single-outcomes)))
         report {:legend-count (count (:legend model))
                 :loop-count (count (:loops model))
                 :element-row-count (count (:elements model))
                 :rule-count (count rules)
                 :rule-kind-counts (frequencies (map :kind rules))
                 :validation stats
           :context-keys (count context)
           :lookup-spec-file lookup-spec-file
           :lookup-spec-count (count (:specs lookup-doc))
           :lookup-enabled-spec-count (count (filter :enabled? (:specs lookup-doc)))
           :lookup-summary (:lookup stats)
           :db-validation-enabled db-enabled?
           :single-query-db-validation-enabled (boolean (and db-enabled? single-query-db-validation? prefetch-data))
           :db-env-name (:env-name db-config)
           :single-query-prefetch-summary (when prefetch-data
                                            {:ok (:ok prefetch-data)
                                             :ssn-count (:ssn-count prefetch-data)
                                             :row-count (:row-count prefetch-data)
                                             :spec-count (:spec-count prefetch-data)
                                             :error (:error prefetch-data)})
              :single-query-legacy-compare (when comparison
                    (assoc comparison
                      :enabled true
                      :performed true))
           :run-id run-id
           :started-at started-at
           :elapsed-ms elapsed-ms
           :subscriber-statuses subscriber-statuses
           :subscriber-progress-summary subscriber-progress-summary
           :subscriber-count (count (concat (:subscribers db-state)
                                            (when-let [cur (:current-subscriber db-state)]
                                              [cur])))}]
        (parser/log-memory! (:log-memory? opts)
                "run-rule-harness:result-built-trees-still-retained"
                {:finding-count (:failed stats)
                 :subscriber-status-count (count subscriber-statuses)
                 :db-row-count (or (:row-count prefetch-data) 0)
                 :db-cache-count (count (or (:values prefetch-data) {}))})
     {:report report
      :rules rules
         :parsed-tree (when (not (false? (:include-parsed? opts))) parse-tree)
       :annotated-tree (when (not (false? (:include-enriched? opts))) annotated-tree)
       :invalid-findings (collect-invalid-findings annotated-tree 1)}))))

(defn run-rule-harness-on-test1
  "Convenience harness for local baseline checks using test1.txt."
  []
  (run-rule-harness
   "src/main/resources/TrentonSystemsInc_GA_CompanionDoc_5010a1-2025-12-29.csv"
   "src/main/resources/edisamples/test1.txt"))

(defn- ensure-parent-dir!
  [output-file]
  (ensure-parent-dir-for-file! output-file))

(defn write-rule-harness-edn!
  "Run harness and write pretty EDN output to file.
   Returns {:output-file ... :result ...}."
  ([companion-csv edi-file output-file]
   (println "[write-rule-harness-edn!]")
   (let [result (run-rule-harness companion-csv edi-file)
         edn-text (io/to-edn-text result)]
     (ensure-parent-dir! output-file)
     (io/write-text output-file edn-text)
     {:output-file output-file
      :result result}))
  ([companion-csv edi-file output-file opts]
   (let [result (run-rule-harness companion-csv edi-file opts)
         edn-text (io/to-edn-text result)]
     (ensure-parent-dir! output-file)
     (io/write-text output-file edn-text)
     {:output-file output-file
      :result result})))

    (defn write-validation-review-edn!
      "Run the existing harness and write a data-only EDN report for local review."
      ([companion-csv edi-file output-file]
       (write-validation-review-edn! companion-csv edi-file output-file {}))
      ([companion-csv edi-file output-file opts]
       (let [result (run-rule-harness companion-csv edi-file opts)
         report (:report result)
         review {:inputs {:companion-guide companion-csv
              :edi-file edi-file}
             :report report
             :subscriber-statuses (:subscriber-statuses report)
             :invalid-findings (:invalid-findings result)
             :parsed-tree (:parsed-tree result)
             :annotated-tree (:annotated-tree result)}]
         (ensure-parent-dir! output-file)
         (io/write-text output-file (io/to-edn-text review))
         {:output-file output-file
      :review review})))

(defn write-rule-harness-json!
  "Run harness and write pretty JSON output to file.
   Returns {:output-file ... :result ...}."
  ([companion-csv edi-file output-file]
   (let [result (run-rule-harness companion-csv edi-file)
         json-text (.stringify js/JSON (clj->js result) nil 2)]
     (ensure-parent-dir! output-file)
     (io/write-text output-file json-text)
     {:output-file output-file
      :result result}))
  ([companion-csv edi-file output-file opts]
   (let [result (run-rule-harness companion-csv edi-file opts)
         json-text (.stringify js/JSON (clj->js result) nil 2)]
     (ensure-parent-dir! output-file)
     (io/write-text output-file json-text)
     {:output-file output-file
      :result result})))

(defn- default-json-output-file
  [edn-output-file]
  (if (str/ends-with? (or edn-output-file "") ".edn")
    (str (subs edn-output-file 0 (- (count edn-output-file) 4)) ".json")
    (str edn-output-file ".json")))

(defn write-rule-harness-on-test1-edn!
  "Run run-rule-harness-on-test1 and write pretty EDN output for detailed review.
  Also writes JSON output alongside EDN.
  Default outputs: save/rule-harness-test1.edn and save/rule-harness-test1.json"
  ([]
   (println "just checking.....")
  (write-rule-harness-on-test1-edn! "save/rule-harness-test1.edn"))
  ([output-file]
   (let [companion-csv "src/main/resources/TrentonSystemsInc_GA_CompanionDoc_5010a1-2025-12-29.csv"
         edi-file "src/main/resources/edisamples/test1.txt"
         json-output-file (default-json-output-file output-file)
         edn-resp (write-rule-harness-edn! companion-csv edi-file output-file)
         json-resp (write-rule-harness-json! companion-csv edi-file json-output-file)]
     {:edn-output-file (:output-file edn-resp)
      :json-output-file (:output-file json-resp)
      :result (:result edn-resp)})))
