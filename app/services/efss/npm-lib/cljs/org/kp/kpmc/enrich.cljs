(ns org.kp.kpmc.enrich
  (:require [clojure.string :as str]
            [cljs.reader :as reader]
            [org.kp.kpmc.companion :as companion]
            [org.kp.kpmc.io-node :as io]))

(defn build-companion-index
  "Build lookup index from companion guide: segment-id -> [loop-defs]."
  [companion-guide]
  (group-by :segment-id (:loops companion-guide)))

(defn find-loop-def
  "Find matching loop definition for a segment id and first element value."
  [index seg-id first-elem-value]
  (let [candidates (get index seg-id)]
    (when (seq candidates)
      (if (= 1 (count candidates))
        (first candidates)
        (or
         (some #(when (= (:kp-element (first (:elements %))) first-elem-value) %)
               candidates)
         (some #(let [kp (:kp-element (first (:elements %)))]
                  (when (and kp first-elem-value
                             (str/includes? kp first-elem-value))
                    %))
               candidates)
         (first candidates))))))

(defn annotate-children
  "Annotate unit child nodes with companion guide element metadata."
  [children elements unit-tag]
  (let [positioned-elements (->> elements
                                 (sort-by #(or (:position (companion/parse-segment-ref (:segment-ref %))) 0))
                                 vec)]
    (first
     (reduce
      (fn [[result idx] child]
        (if (and (sequential? child) (= unit-tag (first child)))
          (let [elem (nth positioned-elements idx nil)
                val (second child)
                annotated (if elem
                            [unit-tag
                             {:ref (:segment-ref elem)
                              :name (:segment-name elem)
                              :usage (:usage elem)}
                             val]
                            child)]
            [(conj result annotated) (inc idx)])
          [(conj result child) idx]))
      [[] 0]
      children))))

(defn parse-kp-allowed-values
  "Parse kp-element spec into a set of literal allowed values."
  [kp-element]
  (when (and kp-element (not (str/blank? kp-element)))
    (let [trimmed (str/trim kp-element)]
      (cond
        (str/starts-with? trimmed "<") nil
        (= trimmed "All values") nil
        (re-matches #"X+" trimmed) nil
        (str/includes? trimmed " or ")
        (let [parts (str/split trimmed #"\s+or\s+")
              left-parts (when (> (count parts) 1)
                           (str/split (first parts) #",\s*"))
              right (last parts)]
          (set (map str/trim (concat (or left-parts [(first parts)]) [right]))))
        (str/includes? trimmed ",")
        (set (map str/trim (str/split trimmed #",\s*")))
        :else #{trimmed}))))

(def kp-format-patterns
  {"<YYMMDD>" #"\d{6}"
   "<CCYYMMDD>" #"\d{8}"
   "<HHMM>" #"\d{4}"
   "<HHMMSS>" #"\d{6}"
   "<HHMMSSDD>" #"\d{6,8}"
   "<Number>" #"\d+"
   "<Unique Number>" #".+"})

(defn validate-kp-format
  "Validate actual-value against kp-element placeholder pattern."
  [kp-element actual-value ref]
  (when-let [pattern (get kp-format-patterns kp-element)]
    (when (and actual-value
               (not (str/blank? actual-value))
               (not (re-matches pattern actual-value)))
      (str ref " format mismatch: expected " kp-element " but got '" actual-value "'"))))

(defn validate-element
  "Validate a single element against companion guide definition."
  [elem-def actual-value]
  (when elem-def
    (let [usage (:usage elem-def)
          kp-element (:kp-element elem-def)
          ref (:segment-ref elem-def)
          trimmed (when actual-value (str/trim actual-value))
          blank? (or (nil? actual-value) (str/blank? actual-value))]
      (cond
        (= usage :not-used)
        (when-not blank?
          (str ref " is Not Used and must be blank, but got '" actual-value "'"))

        (= kp-element "<Blank>")
        (when (not blank?)
          (str ref " should be blank (empty or spaces) but got '" actual-value "'"))

        (and (= usage :required) blank?)
        (str ref " is required but empty")

        blank? nil

        (and kp-element (str/starts-with? kp-element "<"))
        (validate-kp-format kp-element trimmed ref)

        :else
        (let [allowed (parse-kp-allowed-values kp-element)]
          (when (and allowed (not (contains? allowed trimmed)))
            (str ref " value '" actual-value "' not in allowed values: " allowed)))))))

(defn annotate-and-validate-children
  "Annotate unit nodes with companion metadata and validation status."
  [children elements unit-tag]
  (let [positioned-elements (->> elements
                                 (sort-by #(or (:position (companion/parse-segment-ref (:segment-ref %))) 0))
                                 vec)
        {:keys [result errors]}
        (reduce
         (fn [{:keys [result errors idx]} child]
           (if (and (sequential? child) (= unit-tag (first child)))
             (let [elem (nth positioned-elements idx nil)
                   val (second child)
                   error (validate-element elem val)
                   elem-meta (when elem
                               (let [base {:ref (:segment-ref elem)
                                           :name (:segment-name elem)
                                           :usage (:usage elem)
                                           :valid (nil? error)}]
                                 (if error
                                   (assoc base :invalid-description error)
                                   base)))
                   annotated (if elem-meta
                               [unit-tag elem-meta val]
                               child)]
               {:result (conj result annotated)
                :errors (if error (conj errors error) errors)
                :idx (inc idx)})
             {:result (conj result child)
              :errors errors
              :idx idx}))
         {:result [] :errors [] :idx 0}
         children)]
    {:children result :errors errors}))

(defn enrich-parse-tree
  "Walk parse tree and annotate segments/elements with companion guide metadata."
  [parse-tree companion-guide]
  (let [index (build-companion-index companion-guide)
        make-segment-meta
        (fn [loop-def errors]
          (let [base {:loop-name (:loop-name loop-def)
                      :segment-description (:segment-description loop-def)
                      :segment-requirement (:segment-requirement loop-def)}]
            (if (seq errors)
              (assoc base :valid false :invalid-description (str/join "; " errors))
              (assoc base :valid true))))
        enrich
        (fn enrich [node]
          (cond
            (not (sequential? node)) node

            (= :isa_data_segment (first node))
            (let [isa-def (first (get index "ISA"))
                  children (vec (rest node))]
              (if isa-def
                (let [{:keys [children errors]} (annotate-and-validate-children children (:elements isa-def) :isa_data_segment_unit)]
                  (into [:isa_data_segment (make-segment-meta isa-def errors)] children))
                node))

            (= :iea_data_segment (first node))
            (let [iea-def (first (get index "IEA"))
                  children (vec (rest node))]
              (if iea-def
                (let [{:keys [children errors]} (annotate-and-validate-children children (:elements iea-def) :data_segment_unit)]
                  (into [:iea_data_segment (make-segment-meta iea-def errors)] children))
                node))

            (= :function_header (first node))
            (let [gs-def (first (get index "GS"))]
              (if gs-def
                (into [:function_header
                       {:loop-name (:loop-name gs-def)
                        :segment-description (:segment-description gs-def)
                        :segment-requirement (:segment-requirement gs-def)
                        :valid true}]
                      (map enrich (rest node)))
                (into [(first node)] (map enrich (rest node)))))

            (= :function_trailer (first node))
            (let [ge-def (first (get index "GE"))]
              (if ge-def
                (into [:function_trailer
                       {:loop-name (:loop-name ge-def)
                        :segment-description (:segment-description ge-def)
                        :segment-requirement (:segment-requirement ge-def)
                        :valid true}]
                      (map enrich (rest node)))
                (into [(first node)] (map enrich (rest node)))))

            (= :trans_set_header (first node))
            (let [st-def (first (get index "ST"))]
              (if st-def
                (into [:trans_set_header
                       {:loop-name (:loop-name st-def)
                        :segment-description (:segment-description st-def)
                        :segment-requirement (:segment-requirement st-def)
                        :valid true}]
                      (map enrich (rest node)))
                (into [(first node)] (map enrich (rest node)))))

            (= :trans_set_trailer (first node))
            (let [se-def (first (get index "SE"))]
              (if se-def
                (into [:trans_set_trailer
                       {:loop-name (:loop-name se-def)
                        :segment-description (:segment-description se-def)
                        :segment-requirement (:segment-requirement se-def)
                        :valid true}]
                      (map enrich (rest node)))
                (into [(first node)] (map enrich (rest node)))))

            (= :data_segment (first node))
            (let [children (vec (rest node))
                  seg-id-node (first children)
                  seg-id (when (and (sequential? seg-id-node)
                                    (= :seg_id (first seg-id-node)))
                           (second seg-id-node))
                  first-unit (first (filter #(and (sequential? %)
                                                  (= :data_segment_unit (first %)))
                                            children))
                  first-val (when first-unit (second first-unit))
                  loop-def (when seg-id (find-loop-def index seg-id first-val))]
              (if loop-def
                (let [{:keys [children errors]} (annotate-and-validate-children children (:elements loop-def) :data_segment_unit)]
                  (into [:data_segment (make-segment-meta loop-def errors)] children))
                node))

            :else
            (into [(first node)] (map enrich (rest node)))))]
    (enrich parse-tree)))

(defn enrich-x12-with-companion-guide
  "Read parsed X12 EDN and companion EDN files, return enriched parse tree."
  [parse-edn-file companion-edn-file]
  (let [parse-tree (reader/read-string (io/read-text parse-edn-file))
        companion-guide (reader/read-string (io/read-text companion-edn-file))]
    (enrich-parse-tree parse-tree companion-guide)))