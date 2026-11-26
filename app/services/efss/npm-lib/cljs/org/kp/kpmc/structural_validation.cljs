(ns org.kp.kpmc.structural-validation
  (:require [clojure.set :as set]
            [org.kp.kpmc.companion-rules :as companion-rules]))

(def ^:private member-name-loops
  {"IL" "2100A"
   "70" "2100B"
   "31" "2100C"
   "36" "2100D"
   "M8" "2100E"
   "S3" "2100F"
   "CX" "2100G"})

(def ^:private header-name-loops
  {"P5" "1000A"
   "IN" "1000B"
   "TV" "1000C"})

(defn- loop-path
  [loop-name]
  (case loop-name
    ("1000A" "1000B" "1000C") [loop-name]
    "2000" ["2000"]
    ("2100A" "2100B" "2100C" "2100D" "2100E" "2100F" "2100G")
    ["2000" loop-name]
    "2200" ["2000" "2200"]
    "2300" ["2000" "2300"]
    "2310" ["2000" "2300" "2310"]
    "2320" ["2000" "2300" "2320"]
    "2330" ["2000" "2300" "2320" "2330"]
    "2700" ["2000" "2700"]
    "2710" ["2000" "2700" "2710"]
    "2750" ["2000" "2700" "2710" "2750"]
    nil))

(defn- resolution
  [loop-name reason confidence]
  {:loop-name loop-name
   :loop-path (loop-path loop-name)
   :reason reason
   :confidence confidence})

(defn- advance
  [state segment-id values]
  (let [qualifier (first values)
        current-loop (:current-loop state)
        member? (:member? state)
        reporting? (:reporting? state)]
    (cond
      (= segment-id "BGN")
      [(assoc state :current-loop nil :member? false :reporting? false)
       (resolution nil :transaction-reset :structural)]

      (and (not member?) (= segment-id "N1"))
      (let [next-loop (get header-name-loops qualifier)]
        [(assoc state :current-loop next-loop)
         (resolution next-loop :header-entity-qualifier :qualifier)])

      (= segment-id "INS")
      [(assoc state :current-loop "2000" :member? true :reporting? false)
       (resolution "2000" :subscriber-start :structural-starter)]

      (not member?)
      [state (resolution nil :transaction-preamble :inherited)]

      (and (= segment-id "LS") (= qualifier "2700"))
      [(assoc state :current-loop "2700" :reporting? true)
       (resolution "2700" :reporting-loop-start :structural-starter)]

      (and reporting? (= segment-id "LE"))
      [(assoc state :current-loop "2000" :reporting? false)
       (resolution "2700" :reporting-loop-end :structural-starter)]

      (and reporting? (= segment-id "LX"))
      [(assoc state :current-loop "2710")
       (resolution "2710" :reporting-category-start :structural-starter)]

      (and reporting? (= segment-id "N1"))
      [(assoc state :current-loop "2750")
       (resolution "2750" :reporting-category-entity :structural-starter)]

      (= segment-id "DSB")
      [(assoc state :current-loop "2200")
       (resolution "2200" :disability-loop-start :structural-starter)]

      (= segment-id "HD")
      [(assoc state :current-loop "2300")
       (resolution "2300" :coverage-loop-start :structural-starter)]

      (= segment-id "COB")
      [(assoc state :current-loop "2320")
       (resolution "2320" :cob-loop-start :structural-starter)]

      (and (= segment-id "LX")
           (contains? #{"2300" "2310"} current-loop))
      [(assoc state :current-loop "2310")
       (resolution "2310" :provider-loop-start :structural-starter)]

      (and (= segment-id "NM1")
           (contains? #{"2320" "2330"} current-loop))
      [(assoc state :current-loop "2330")
       (resolution "2330" :cob-entity-start :structural-starter)]

      (and (= segment-id "NM1") (= current-loop "2310"))
      [state (resolution "2310" :provider-entity :inherited)]

      (= segment-id "NM1")
      (let [next-loop (or (get member-name-loops qualifier) "2100A")]
        [(assoc state :current-loop next-loop)
         (resolution next-loop :member-entity-qualifier :qualifier)])

      :else
      [state (resolution current-loop :current-structural-loop :inherited)])))

(defn make-834-loop-resolver
  "Create a stateful resolver for one ordered 834 validation walk.
   The returned function accepts reset and segment events and records decisions."
  ([] (make-834-loop-resolver nil))
  ([decisions*]
   (let [state* (atom {:current-loop nil
                       :member? false
                       :reporting? false
                       :segment-index 0})]
     (fn [{:keys [event scope segment-id values]}]
       (if (= event :reset)
         (do
           (reset! state* {:current-loop nil
                           :member? false
                           :reporting? false
                           :segment-index 0})
           {:loop-name nil
            :loop-path nil
            :reason :reset
            :scope scope
            :confidence :structural})
         (let [previous @state*
               [next-state result] (advance previous segment-id values)
               segment-index (inc (:segment-index previous))
               next-state (assoc next-state :segment-index segment-index)
               decision (assoc result
                               :segment-index segment-index
                               :segment-id segment-id
                               :qualifier (first values)
                               :previous-loop (:current-loop previous))]
           (reset! state* next-state)
           (when decisions*
             (swap! decisions* conj decision))
           decision))))))

(defn run-structural-rule-harness
  "Run the existing rules through an independent 834 structural-loop resolver."
  ([companion-csv edi-file]
   (run-structural-rule-harness companion-csv edi-file {}))
  ([companion-csv edi-file opts]
   (when (true? (:streaming? opts))
     (throw (ex-info "Structural 834 evaluation does not yet support streaming mode"
                     {:type :unsupported-structural-streaming})))
   (let [decisions* (atom [])
         resolver (make-834-loop-resolver decisions*)
         result (companion-rules/run-rule-harness
                 companion-csv
                 edi-file
                 (assoc opts :structural-loop-resolver resolver))
         evaluation {:mode :structural-834
                     :version 1
                     :decision-count (count @decisions*)
                     :decisions @decisions*}]
     (-> result
         (assoc :structural-evaluation evaluation)
         (update :report assoc :loop-resolution evaluation)))))

(defn- finding-key
  [finding]
  (select-keys finding
               [:isa-index :subscriber-index :segment :ref :failed-value
                :loop-name :loop-description]))

(defn compare-rule-harnesses
  "Run legacy and structural validation and report finding-level differences."
  ([companion-csv edi-file]
   (compare-rule-harnesses companion-csv edi-file {}))
  ([companion-csv edi-file opts]
   (let [legacy (companion-rules/run-rule-harness companion-csv edi-file opts)
         structural (run-structural-rule-harness companion-csv edi-file opts)
         legacy-findings (set (map finding-key (:invalid-findings legacy)))
         structural-findings (set (map finding-key (:invalid-findings structural)))
         shared (set/intersection legacy-findings structural-findings)]
     {:summary {:legacy-finding-count (count legacy-findings)
                :structural-finding-count (count structural-findings)
                :shared-finding-count (count shared)
                :legacy-only-count (count (set/difference legacy-findings shared))
                :structural-only-count (count (set/difference structural-findings shared))}
      :legacy-only (vec (set/difference legacy-findings shared))
      :structural-only (vec (set/difference structural-findings shared))
      :shared (vec shared)
      :legacy legacy
      :structural structural})))
