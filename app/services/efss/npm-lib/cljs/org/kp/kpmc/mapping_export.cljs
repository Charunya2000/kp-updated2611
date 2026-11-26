(ns org.kp.kpmc.mapping-export
  "Generate lookup specs and CSV exports from companion-guide mapping EDN."
  (:require [cljs.pprint :as pprint]
            [cljs.reader :as reader]
            [clojure.string :as str]
            [org.kp.kpmc.io-node :as io]))

(def default-mapping-edn "src/main/resources/companion-guide-db-mapping.edn")
(def default-output-csv "target/companion-guide-db-mapping.csv")
(def default-lookup-spec-edn "src/main/resources/companion-db-lookups.edn")

(def subscriber-lookup-tables
  #{"TAP_COVERAGE"
    "TAP_PERSON"
    "TAP_PERSON_COVERAGE"
    "TAP_PERSON_ADDRESS"
    "TAP_PERSON_PHONE"
    "TAP_PERSON_EMAIL"
    "TAP_PERSON_LANGUAGE"
    "TAP_PERSON_EXTERNAL_IDENTIFIER"
    "TAP_PERSON_COVERAGE_ATTRIBUTE"
    "TAP_PERSON_COVERAGE_ADDRESS"
    "TAP_PERSON_COVERAGE_AFFILIATION"
    "TAP_PERSON_COVERAGE_AFFILIATION_COMM"
    "TAP_PERSON_COVERAGE_PREMIUM_RATE"
    "TAP_PERSON_COVERAGE_RIDER"
    "TAP_PLAN_GROUP"})

(def qualifier-by-segment-description
  {"Subscriber SSN" "0F"
   "Group Number / Purchaser ID" "1L"
   "Client Number" "23"
   "Subgroup Number" "DX"
   "Bill Group" "ZZ"})

(def subscriber-ref-descriptions
  (set (keys qualifier-by-segment-description)))

(def csv-headers
  ["loop" "segment_id" "segment_description" "table" "business_object"
   "segment_ref" "column" "data_type" "context" "notes"])

(defn- normalize [value]
  (cond
    (keyword? value) (name value)
    (string? value) value
    (nil? value) ""
    :else (str value)))

(defn- element->row [loop-name segment target element]
  [(normalize loop-name)
   (normalize (:segment-id segment))
   (normalize (:segment-description segment))
   (normalize (:table target))
   (normalize (:business-object target))
   (normalize (:segment-ref element))
   (normalize (:column element))
   (normalize (:data-type element))
   (normalize (:context element))
   (normalize (:notes element))])

(defn mapping->rows [mapping]
  (vec
   (for [loop-entry (:mappings mapping)
         :let [loop-name (:loop loop-entry)]
         segment (:segments loop-entry)
         target (:targets segment)
         element (:elements target)]
     (element->row loop-name segment target element))))

(defn- mapping->entries [mapping]
  (vec
   (for [loop-entry (:mappings mapping)
         :let [loop-name (:loop loop-entry)]
         segment (:segments loop-entry)
         target (:targets segment)
         element (:elements target)]
     {:loop loop-name
      :segment-id (:segment-id segment)
      :segment-description (:segment-description segment)
      :segment-ref (:segment-ref element)
      :table (:table target)
      :column (:column element)})))

(defn- subscriber-loop? [loop-name]
  (boolean (re-matches #"^[2-9].*" (str loop-name))))

(defn- lookup-id [& parts]
  (->> parts
       (map str)
       (map str/lower-case)
       (map #(str/replace % #"[^a-z0-9]+" "-"))
       (map #(str/replace % #"(^-|-$)" ""))
       (remove empty?)
       (str/join "-")))

(defn- table-column-spec [{:keys [loop segment-id segment-ref table column]}]
  {:id (lookup-id loop segment-id segment-ref)
   :loop loop
   :segment-id segment-id
   :segment-ref segment-ref
   :enabled? true
   :lookup-kind :table-column
   :table table
   :column column})

(defn- conditional-ref02-spec [entries]
  (let [{:keys [loop segment-id segment-ref]} (first entries)]
    {:id (lookup-id loop segment-id segment-ref)
     :loop loop
     :segment-id segment-id
     :segment-ref segment-ref
     :enabled? true
     :lookup-kind :conditional-table-column
     :cases (mapv (fn [{:keys [segment-description table column]}]
                    {:when {:ref "REF01"
                            :equals (get qualifier-by-segment-description segment-description)}
                     :table table
                     :column column})
                  entries)}))

(defn- coverage-date-spec []
  {:id "2300-dtp-dtp03"
   :loop "2300"
   :segment-id "DTP"
   :segment-ref "DTP03"
   :enabled? true
   :lookup-kind :conditional-table-column
   :cases [{:when {:ref "DTP01" :equals "348"}
            :table "TAP_COVERAGE"
            :column "COVERAGE_START_DATE"}
           {:when {:ref "DTP01" :equals "349"}
            :table "TAP_COVERAGE"
            :column "COVERAGE_END_DATE"}]})

(defn mapping->lookup-specs [mapping]
  (let [entries (->> (mapping->entries mapping)
                     (filter #(subscriber-loop? (:loop %)))
                     (filter #(contains? subscriber-lookup-tables (:table %)))
                     (filter #(or (not= "REF02" (:segment-ref %))
                                  (contains? subscriber-ref-descriptions
                                             (:segment-description %))))
                     (remove #(= "DTP01" (:segment-ref %)))
                     (remove #(and (= "2300" (:loop %))
                                   (= "DTP03" (:segment-ref %))))
                     vec)
        grouped (group-by (juxt :loop :segment-id :segment-ref) entries)
        specs (mapv (fn [[key matching-entries]]
                      (if (= key ["2000" "REF" "REF02"])
                        (conditional-ref02-spec matching-entries)
                        (table-column-spec (first matching-entries))))
                    (sort-by key grouped))]
    (->> (conj specs (coverage-date-spec))
         (sort-by (juxt :loop :segment-id :segment-ref))
         vec)))

(defn read-mapping-edn [path]
  (reader/read-string (io/read-text path)))

(defn- write-text-with-parents! [output-path text]
  (let [fs (js/require "fs")
        path (js/require "path")
        parent (.dirname path output-path)]
    (.mkdirSync fs parent #js {:recursive true})
    (io/write-text output-path text)))

(defn write-lookup-specs!
  ([mapping-path output-path]
   (let [mapping (read-mapping-edn mapping-path)
         specs (mapping->lookup-specs mapping)
         document {:source-mapping mapping-path :specs specs}]
     (when (empty? specs)
       (throw (ex-info "No subscriber lookup specs generated" {:mapping-path mapping-path})))
     (write-text-with-parents! output-path (with-out-str (pprint/pprint document)))
     {:specs (count specs) :output output-path}))
  ([]
   (write-lookup-specs! default-mapping-edn default-lookup-spec-edn)))

(defn- csv-cell [value]
  (let [text (normalize value)]
    (if (re-find #"[\",\r\n]" text)
      (str "\"" (str/replace text "\"" "\"\"") "\"")
      text)))

(defn write-csv! [rows output-path]
  (let [lines (map #(str/join "," (map csv-cell %)) (cons csv-headers rows))]
    (write-text-with-parents! output-path (str (str/join "\n" lines) "\n"))))

(defn export-mapping!
  ([edn-path csv-path]
   (let [mapping (read-mapping-edn edn-path)
         rows (mapping->rows mapping)]
     (when (empty? rows)
       (throw (ex-info "No mapping rows found" {:edn-path edn-path})))
     (write-csv! rows csv-path)
     {:rows (count rows) :output csv-path}))
  ([]
   (export-mapping! default-mapping-edn default-output-csv)))