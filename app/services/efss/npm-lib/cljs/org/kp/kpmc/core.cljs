(ns org.kp.kpmc.core
  (:require [org.kp.kpmc.io-node :as io]
            [org.kp.kpmc.parser :as parser]
            [org.kp.kpmc.companion :as companion]
            [org.kp.kpmc.enrich :as enrich]
            [org.kp.kpmc.companion-rules :as companion-rules]
            [org.kp.kpmc.structural-validation :as structural-validation]
            [org.kp.kpmc.mapping-export :as mapping-export]
            [org.kp.kpmc.cli :as cli]))

;; IO
(def read-text io/read-text)
(def write-text io/write-text)
(def to-edn-text io/to-edn-text)

;; Parser
(def reverso parser/reverso)
(def extract-text-by-span parser/extract-text-by-span)
(def find-in-parse-tree parser/find-in-parse-tree)
(def find-all-nodes parser/find-all-nodes)
(def create-parsers parser/create-parsers)
(def testX12 parser/testX12)
(def testX12-stage1 parser/testX12-stage1)
(def testX12-stage2 parser/testX12-stage2)
(def testX12-stage3 parser/testX12-stage3)
(def testX12-hierarchical parser/testX12-hierarchical)
(def parse-envelope parser/parse-envelope)
(def extract-function-bodies parser/extract-function-bodies)
(def parse-function-body parser/parse-function-body)
(def extract-transaction-sets parser/extract-transaction-sets)
(def parse-trans-body parser/parse-trans-body)
(def parse-x12-chunked parser/parse-x12-chunked)
(def test-chunked-parse parser/test-chunked-parse)
(def parse-x12-full parser/parse-x12-full)
(def test-full-parse parser/test-full-parse)

;; JSON-friendly parser wrappers for Node.js consumers.
(defn parse-x12-chunked-json
  [filepath]
  (clj->js (parser/parse-x12-chunked filepath)))

(defn parse-x12-full-json
  [filepath]
  (clj->js (parser/parse-x12-full filepath)))

;; Companion guide parsing
(def join-multiline-quoted-fields companion/join-multiline-quoted-fields)
(def join-multiline-quoted-fields-with-source companion/join-multiline-quoted-fields-with-source)
(def parse-csv-line companion/parse-csv-line)
(def parse-loop-header companion/parse-loop-header)
(def parse-companion-guide-text companion/parse-companion-guide-text)
(def parse-companion-guide companion/parse-companion-guide)
(def save-companion-guide-edn companion/save-companion-guide-edn)
(def parse-segment-ref companion/parse-segment-ref)

;; Companion DB mapping exports
(def mapping->lookup-specs mapping-export/mapping->lookup-specs)
(def write-lookup-specs! mapping-export/write-lookup-specs!)
(def export-mapping! mapping-export/export-mapping!)

(defn parse-companion-guide-json
  [csv-file]
  (clj->js (companion/parse-companion-guide csv-file)))

(defn parse-companion-guide-editable-text-json
  [csv-text opts-json]
  (let [opts (if (some? opts-json)
               (js->clj opts-json :keywordize-keys true)
               {})
        model (companion-rules/parse-companion-csv->model csv-text)]
    (clj->js (companion-rules/model->editable-document model (:sourceName opts)))))

(defn parse-companion-guide-editable-json
  [csv-file]
  (let [path (js/require "path")
        model (companion-rules/parse-companion-csv->model (io/read-text csv-file))]
    (clj->js (companion-rules/model->editable-document model (.basename path csv-file)))))

;; Enrichment and validation
(def build-companion-index enrich/build-companion-index)
(def find-loop-def enrich/find-loop-def)
(def annotate-children enrich/annotate-children)
(def parse-kp-allowed-values enrich/parse-kp-allowed-values)
(def validate-kp-format enrich/validate-kp-format)
(def validate-element enrich/validate-element)
(def annotate-and-validate-children enrich/annotate-and-validate-children)
(def enrich-parse-tree enrich/enrich-parse-tree)
(def enrich-x12-with-companion-guide enrich/enrich-x12-with-companion-guide)

(defn enrich-parse-tree-json
  [parse-tree-json companion-guide-json]
  (let [keywordize-node-tags
        (fn keywordize-node-tags [node]
          (cond
            (vector? node)
            (let [head (first node)
                  normalized-head (if (string? head) (keyword head) head)]
              (into [normalized-head]
                    (map keywordize-node-tags (rest node))))

            (map? node)
            (into {} (map (fn [[k v]] [k (keywordize-node-tags v)]) node))

            (sequential? node)
            (mapv keywordize-node-tags node)

            :else node))
        parse-tree (-> parse-tree-json
                       (js->clj :keywordize-keys true)
                       keywordize-node-tags)
        companion-guide (js->clj companion-guide-json :keywordize-keys true)]
    (clj->js (enrich/enrich-parse-tree parse-tree companion-guide))))

;; Companion rule harness / validation
(def run-rule-harness companion-rules/run-rule-harness)
(def run-structural-rule-harness structural-validation/run-structural-rule-harness)
(def compare-rule-harnesses structural-validation/compare-rule-harnesses)

(defn- normalize-rule-harness-opts
  [opts]
  (let [o (or opts {})]
    (cond-> o
      (contains? o :lookupSpecFile)
      (assoc :lookup-spec-file (:lookupSpecFile o))

      (contains? o :includeLookupSql)
      (assoc :include-lookup-sql? (:includeLookupSql o))

      (contains? o :includeLookupSql?)
      (assoc :include-lookup-sql? (:includeLookupSql? o))

      (contains? o :dbValidation)
      (assoc :db-validation? (:dbValidation o))

      (contains? o :dbValidation?)
      (assoc :db-validation? (:dbValidation? o))

      (contains? o :progressOutputFile)
      (assoc :progress-output-file (:progressOutputFile o))

      (contains? o :onProgress)
      (assoc :on-progress (:onProgress o))

      (contains? o :heartbeatEveryDbAttempts)
      (assoc :heartbeat-every-db-attempts (:heartbeatEveryDbAttempts o))

      (contains? o :runId)
      (assoc :run-id (:runId o))

      (contains? o :totalSubscribers)
      (assoc :total-subscribers (:totalSubscribers o))

      (contains? o :singleQueryDbValidation)
      (assoc :single-query-db-validation? (:singleQueryDbValidation o))

      (contains? o :singleQueryDbValidation?)
      (assoc :single-query-db-validation? (:singleQueryDbValidation? o))

      (contains? o :compareSingleQueryVsLegacy)
      (assoc :compare-single-query-vs-legacy? (:compareSingleQueryVsLegacy o))

      (contains? o :compareSingleQueryVsLegacy?)
      (assoc :compare-single-query-vs-legacy? (:compareSingleQueryVsLegacy? o))

      (contains? o :envName)
      (assoc :env-name (:envName o))

      (contains? o :subscriberOnlyDbValidation)
      (assoc :subscriber-only-db-validation? (:subscriberOnlyDbValidation o))

      (contains? o :logMemory)
      (assoc :log-memory? (:logMemory o))

      (contains? o :includeParsed)
      (assoc :include-parsed? (:includeParsed o))

      (contains? o :includeEnriched)
      (assoc :include-enriched? (:includeEnriched o))

      (contains? o :streaming)
      (assoc :streaming? (:streaming o))

      (contains? o :readBufferSize)
      (assoc :read-buffer-size (:readBufferSize o))

      (contains? o :subscriberBatchSize)
      (assoc :subscriber-batch-size (:subscriberBatchSize o))

      (contains? o :collectInvalidFindings)
      (assoc :collect-invalid-findings? (:collectInvalidFindings o))

      (contains? o :collectSubscriberStatuses)
      (assoc :collect-subscriber-statuses? (:collectSubscriberStatuses o))

      (contains? o :findingBatchSize)
      (assoc :finding-batch-size (:findingBatchSize o))

      (contains? o :onFindingBatch)
      (assoc :on-finding-batch (:onFindingBatch o))

      (contains? o :findingOutputFile)
      (assoc :finding-output-file (:findingOutputFile o))

      (contains? o :validationScope)
      (assoc :validation-scope (:validationScope o)))))

(defn capabilities-json
  []
  (clj->js {:streaming true
            :subscriberBoundedStreaming true
            :subscriberBatching true
            :defaultSubscriberBatchSize 1
            :compactInvalidFindings true
            :subscriberStatusCollectionControl true
            :findingBatchEvents true
            :findingNdjsonOutput true
            :isaProgressEvents true
            :treeOutputControls true
            :structural834Evaluation true
            :structural834EvaluationVersion 1
            :editableCompanionGuide true
            :editableCompanionGuideSchemaVersion
            companion-rules/editable-companion-guide-schema-version}))

(defn run-rule-harness-json
  [companion-csv edi-file opts-json]
  (let [opts (normalize-rule-harness-opts
              (if (some? opts-json)
                (js->clj opts-json :keywordize-keys true)
                {}))]
    (clj->js (companion-rules/run-rule-harness companion-csv edi-file opts))))

(defn run-structural-rule-harness-json
  [companion-csv edi-file opts-json]
  (let [opts (normalize-rule-harness-opts
              (if (some? opts-json)
                (js->clj opts-json :keywordize-keys true)
                {}))]
    (clj->js (structural-validation/run-structural-rule-harness
              companion-csv edi-file opts))))

(defn compare-rule-harnesses-json
  [companion-csv edi-file opts-json]
  (let [opts (normalize-rule-harness-opts
              (if (some? opts-json)
                (js->clj opts-json :keywordize-keys true)
                {}))]
    (clj->js (structural-validation/compare-rule-harnesses
              companion-csv edi-file opts))))

(defn- rule-harness-result-json
  [harness opts]
  (let [_ (when (and (true? (:streaming? opts))
               (not (contains? harness :invalid-findings)))
            (throw (ex-info "Compiled EFS-S does not support bounded-memory streaming"
                {:type :missing-streaming-capability})))
        report (:report harness)
        include-parsed? (not (false? (:include-parsed? opts)))
        include-enriched? (not (false? (:include-enriched? opts)))
        payload (cond-> {:validation-summary {:total (get-in report [:validation :total])
                      :passed (get-in report [:validation :passed])
                      :failed (get-in report [:validation :failed])
                      :lookup (:lookup-summary report)
                      :subscriber-progress (:subscriber-progress-summary report)}
             :invalid-findings (:invalid-findings harness)}
                  include-parsed? (assoc :parsed (:parsed-tree harness))
                  include-enriched? (assoc :enriched (:annotated-tree harness)))
        _ (parser/log-memory! (:log-memory? opts) "parse-enrich-validate:before-clj-to-js"
                              {:finding-count (count (:invalid-findings harness))
                               :subscriber-status-count (count (:subscriber-statuses report))})
        result (clj->js payload)
        report-json (clj->js report)
        _ (aset result "report" report-json)
        _ (aset result "subscriber-statuses" (aget report-json "subscriber-statuses"))
        _ (parser/log-memory! (:log-memory? opts) "parse-enrich-validate:after-clj-to-js"
                              {:finding-count (count (:invalid-findings harness))
                               :subscriber-status-count (count (:subscriber-statuses report))})]
    result))

(def ^:private structural-provenance-keys
  #{:structural-evaluation
    :loop-resolution
    :structural-loop-name
    :structural-loop-path
    :loop-selection-strategy})

(defn- strip-structural-provenance
  [value]
  (cond
    (map? value)
    (reduce-kv (fn [result key item]
                 (if (contains? structural-provenance-keys key)
                   result
                   (assoc result key (strip-structural-provenance item))))
               (empty value)
               value)

    (vector? value)
    (mapv strip-structural-provenance value)

    (sequential? value)
    (map strip-structural-provenance value)

    :else value))

(defn parse-enrich-validate-json
  "One-step API for Node consumers.
   Returns parsed tree, enriched tree, and validation summary JSON-friendly payload."
  [companion-csv edi-file opts-json]
  (let [opts (normalize-rule-harness-opts
              (if (some? opts-json)
                (js->clj opts-json :keywordize-keys true)
                {}))
        harness (companion-rules/run-rule-harness companion-csv edi-file opts)]
    (rule-harness-result-json harness opts)))

(defn parse-enrich-validate-structural-json
  "Structural 834 validation with the same public payload shape as parse-enrich-validate-json."
  [companion-csv edi-file opts-json]
  (let [opts (normalize-rule-harness-opts
              (if (some? opts-json)
                (js->clj opts-json :keywordize-keys true)
                {}))
        harness (-> (structural-validation/run-structural-rule-harness
                     companion-csv edi-file opts)
                    strip-structural-provenance)]
    (rule-harness-result-json harness opts)))

(defn validate-editable-companion-guide-json
  [editable-document-json edi-file opts-json]
  (let [document (js->clj editable-document-json :keywordize-keys true)
        validation (companion-rules/validate-editable-document document)]
    (when-not (:valid? validation)
      (let [error (js/Error. "Editable companion guide is invalid")]
        (set! (.-type error) "invalid-editable-companion-guide")
        (set! (.-details error)
            (clj->js {:diagnostics
              (mapv companion-rules/diagnostic->public
                (:diagnostics validation))}))
        (throw error)))
    (let [opts (normalize-rule-harness-opts
                (if (some? opts-json)
                  (js->clj opts-json :keywordize-keys true)
                  {}))
          harness (companion-rules/run-rule-harness (:model validation) edi-file opts)]
      (rule-harness-result-json harness opts))))

;; CLI
(def parse-cli-opts cli/parse-cli-opts)
(def cli-usage cli/cli-usage)
(def require-opt cli/require-opt)
(def run-cli! cli/run-cli!)

(defn -main
  [& args]
  (apply cli/-main args))

(set! *main-cli-fn* -main)