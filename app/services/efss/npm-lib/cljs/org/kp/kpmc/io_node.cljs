(ns org.kp.kpmc.io-node
  (:require [cljs.pprint :as pprint]))

(defn read-text
  "Read UTF-8 text from disk via Node.js fs."
  [path]
  (.readFileSync (js/require "fs") path "utf8"))

(defn reduce-isa-file
  "Reduce complete ISA/IEA interchanges from a file without retaining prior ISAs."
  ([path rf init]
   (reduce-isa-file path {} rf init))
  ([path opts rf init]
   (let [fs (js/require "fs")
         StringDecoder (.-StringDecoder (js/require "string_decoder"))
         decoder (StringDecoder. "utf8")
         chunk-size (max 1024 (or (:read-buffer-size opts) 65536))
         buffer (js/Buffer.alloc chunk-size)
         fd (.openSync fs path "r")
         pending* (atom "")
         terminator* (atom nil)
         isa-segments* (atom nil)
         isa-index* (atom 0)
         acc* (atom init)
         process-segment!
         (fn [raw-segment]
           (let [segment (.trim raw-segment)
                 segment-id (first (.split segment "*"))]
             (when (seq segment)
               (cond
                 (= segment-id "ISA")
                 (if @isa-segments*
                   (throw (ex-info "Nested ISA encountered before IEA"
                                   {:type :nested-isa
                                    :isa-index (inc @isa-index*)}))
                   (reset! isa-segments* [segment]))

                 (nil? @isa-segments*)
                 (throw (ex-info "Content before the first ISA is not supported"
                                 {:type :content-before-isa
                                  :segment-id segment-id}))

                 :else
                 (do
                   (swap! isa-segments* conj segment)
                   (when (= segment-id "IEA")
                     (let [segments @isa-segments*
                           isa-index (swap! isa-index* inc)]
                       (when (<= (count segments) 2)
                         (throw (ex-info "ISA interchange contains no functional-group content"
                                         {:type :empty-isa
                                          :isa-index isa-index})))
                       (reset! acc* (rf @acc*
                                       {:isa-index isa-index
                                        :segment-count (count segments)
                                        :text (str (.join (clj->js segments) @terminator*)
                                                   @terminator*)}))
                       (reset! isa-segments* nil))))))))
         consume-complete-segments!
         (fn []
           (loop []
             (when-let [terminator @terminator*]
               (let [pending @pending*
                     idx (.indexOf pending terminator)]
                 (when (not= -1 idx)
                   (process-segment! (.slice pending 0 idx))
                   (reset! pending* (.slice pending (inc idx)))
                   (recur))))))]
     (try
       (loop [position 0]
         (let [bytes-read (.readSync fs fd buffer 0 chunk-size position)]
           (if (zero? bytes-read)
             (do
               (swap! pending* str (.end decoder))
               (when (and (nil? @terminator*) (seq (.trim @pending*)))
                 (throw (ex-info "Unable to detect the ISA segment terminator"
                                 {:type :invalid-segment-terminator})))
               (consume-complete-segments!)
               (when (seq (.trim @pending*))
                 (throw (ex-info "Input ends with an unterminated segment"
                                 {:type :invalid-segment-terminator})))
               (when @isa-segments*
                 (throw (ex-info "ISA interchange is missing its IEA trailer"
                                 {:type :missing-iea
                                  :isa-index (inc @isa-index*)})))
               (when (zero? @isa-index*)
                 (throw (ex-info "EDI file contains no ISA interchange"
                                 {:type :empty-edi-file})))
               @acc*)
             (do
               (swap! pending* str (.write decoder (.subarray buffer 0 bytes-read)))
               (when (and (nil? @terminator*) (>= (count @pending*) 106))
                 (when-not (= "ISA" (.slice @pending* 0 3))
                   (throw (ex-info "EDI input must begin with ISA"
                                   {:type :content-before-isa})))
                 (let [terminator (.charAt @pending* 105)]
                   (when (or (= terminator "")
                             (boolean (re-matches #"[A-Za-z0-9*\x00-\x20\x7F-\xFF]"
                                                 terminator)))
                     (throw (ex-info "Invalid ISA segment terminator"
                                     {:type :invalid-segment-terminator})))
                   (reset! terminator* terminator)))
               (consume-complete-segments!)
               (recur (+ position bytes-read))))))
       (finally
         (.closeSync fs fd))))))

(defn reduce-ins-file
  "Reduce an EDI file as ordered context segments and INS-started subscriber blocks.
  Only the current subscriber block is retained."
  ([path rf init]
   (reduce-ins-file path {} rf init))
  ([path opts rf init]
   (let [fs (js/require "fs")
         StringDecoder (.-StringDecoder (js/require "string_decoder"))
         decoder (StringDecoder. "utf8")
         chunk-size (max 1024 (or (:read-buffer-size opts) 65536))
         buffer (js/Buffer.alloc chunk-size)
         fd (.openSync fs path "r")
         pending* (atom "")
         terminator* (atom nil)
         isa-index* (atom 0)
         transaction-index* (atom 0)
         subscriber-index* (atom 0)
         isa-segment-count* (atom 0)
         in-isa?* (atom false)
         in-group?* (atom false)
         in-transaction?* (atom false)
         subscriber-segments* (atom nil)
         acc* (atom init)
         emit! (fn [unit]
                 (reset! acc* (rf @acc* unit)))
         flush-subscriber!
         (fn []
           (when-let [segments @subscriber-segments*]
             (emit! {:type :subscriber
                     :isa-index @isa-index*
                     :transaction-index @transaction-index*
                     :subscriber-index @subscriber-index*
                     :segment-count (count segments)
                     :text (str (.join (clj->js segments) @terminator*)
                                @terminator*)})
             (reset! subscriber-segments* nil)))
         emit-context!
         (fn [segment segment-id]
           (emit! {:type :context
                   :isa-index @isa-index*
                   :transaction-index (when @in-transaction?*
                                        @transaction-index*)
                   :segment-id segment-id
                   :segment segment
                   :text (str segment @terminator*)}))
         process-segment!
         (fn [raw-segment]
           (let [segment (.trim raw-segment)
                 segment-id (first (.split segment "*"))]
             (when (seq segment)
               (cond
                 (= segment-id "ISA")
                 (if @in-isa?*
                   (throw (ex-info "Nested ISA encountered before IEA"
                                   {:type :nested-isa
                                    :isa-index (inc @isa-index*)}))
                   (do
                     (swap! isa-index* inc)
                     (reset! transaction-index* 0)
                     (reset! isa-segment-count* 1)
                     (reset! in-isa?* true)
                     (reset! in-group?* false)
                     (emit-context! segment segment-id)))

                 (not @in-isa?*)
                 (throw (ex-info "Content before the first ISA is not supported"
                                 {:type :content-before-isa
                                  :segment-id segment-id}))

                 :else
                 (do
                   (swap! isa-segment-count* inc)
                   (cond
                     (= segment-id "GS")
                     (do
                       (when (or @in-group?* @in-transaction?*)
                         (throw (ex-info "Nested GS encountered before GE"
                                         {:type :nested-functional-group
                                          :isa-index @isa-index*})))
                       (reset! in-group?* true)
                       (emit-context! segment segment-id))

                     (= segment-id "ST")
                     (do
                       (when-not @in-group?*
                         (throw (ex-info "ST encountered outside a GS/GE group"
                                         {:type :st-outside-functional-group
                                          :isa-index @isa-index*})))
                       (when @in-transaction?*
                         (throw (ex-info "Nested ST encountered before SE"
                                         {:type :nested-transaction
                                          :isa-index @isa-index*
                                          :transaction-index @transaction-index*})))
                       (swap! transaction-index* inc)
                       (reset! in-transaction?* true)
                       (emit-context! segment segment-id))

                     (= segment-id "INS")
                     (do
                       (when-not @in-transaction?*
                         (throw (ex-info "INS encountered outside an ST/SE transaction"
                                         {:type :ins-outside-transaction
                                          :isa-index @isa-index*})) )
                       (flush-subscriber!)
                       (swap! subscriber-index* inc)
                       (reset! subscriber-segments* [segment]))

                     (= segment-id "SE")
                     (do
                       (when-not @in-transaction?*
                         (throw (ex-info "SE encountered without ST"
                                         {:type :se-without-st
                                          :isa-index @isa-index*})))
                       (flush-subscriber!)
                       (emit-context! segment segment-id)
                       (reset! in-transaction?* false))

                     (= segment-id "GE")
                     (do
                       (when @in-transaction?*
                         (throw (ex-info "Functional group ended before SE"
                                         {:type :missing-se
                                          :isa-index @isa-index*
                                          :transaction-index @transaction-index*})))
                       (when-not @in-group?*
                         (throw (ex-info "GE encountered without GS"
                                         {:type :ge-without-gs
                                          :isa-index @isa-index*})))
                       (emit-context! segment segment-id)
                       (reset! in-group?* false))

                     (= segment-id "IEA")
                     (do
                       (when @in-transaction?*
                         (throw (ex-info "ISA interchange ended before SE"
                                         {:type :missing-se
                                          :isa-index @isa-index*
                                          :transaction-index @transaction-index*})))
                       (when @in-group?*
                         (throw (ex-info "ISA interchange ended before GE"
                                         {:type :missing-ge
                                          :isa-index @isa-index*})))
                       (when (<= @isa-segment-count* 2)
                         (throw (ex-info "ISA interchange contains no functional-group content"
                                         {:type :empty-isa
                                          :isa-index @isa-index*})))
                       (emit-context! segment segment-id)
                       (reset! in-isa?* false))

                     @subscriber-segments*
                     (swap! subscriber-segments* conj segment)

                     :else
                     (emit-context! segment segment-id)))))))
         consume-complete-segments!
         (fn []
           (loop []
             (when-let [terminator @terminator*]
               (let [pending @pending*
                     idx (.indexOf pending terminator)]
                 (when (not= -1 idx)
                   (process-segment! (.slice pending 0 idx))
                   (reset! pending* (.slice pending (inc idx)))
                   (recur))))))]
     (try
       (loop [position 0]
         (let [bytes-read (.readSync fs fd buffer 0 chunk-size position)]
           (if (zero? bytes-read)
             (do
               (swap! pending* str (.end decoder))
               (when (and (nil? @terminator*) (seq (.trim @pending*)))
                 (throw (ex-info "Unable to detect the ISA segment terminator"
                                 {:type :invalid-segment-terminator})))
               (consume-complete-segments!)
               (when (seq (.trim @pending*))
                 (throw (ex-info "Input ends with an unterminated segment"
                                 {:type :invalid-segment-terminator})))
               (when @in-isa?*
                 (cond
                   @in-transaction?*
                   (throw (ex-info "Transaction is missing its SE trailer"
                                   {:type :missing-se
                                    :isa-index @isa-index*
                                    :transaction-index @transaction-index*}))

                   @in-group?*
                   (throw (ex-info "Functional group is missing its GE trailer"
                                   {:type :missing-ge
                                    :isa-index @isa-index*}))

                   :else
                   (throw (ex-info "ISA interchange is missing its IEA trailer"
                                   {:type :missing-iea
                                    :isa-index @isa-index*}))))
               (when (zero? @isa-index*)
                 (throw (ex-info "EDI file contains no ISA interchange"
                                 {:type :empty-edi-file})))
               @acc*)
             (do
               (swap! pending* str (.write decoder (.subarray buffer 0 bytes-read)))
               (when (and (nil? @terminator*) (>= (count @pending*) 106))
                 (when-not (= "ISA" (.slice @pending* 0 3))
                   (throw (ex-info "EDI input must begin with ISA"
                                   {:type :content-before-isa})))
                 (let [terminator (.charAt @pending* 105)]
                   (when (or (= terminator "")
                             (boolean (re-matches #"[A-Za-z0-9*\x00-\x20\x7F-\xFF]"
                                                 terminator)))
                     (throw (ex-info "Invalid ISA segment terminator"
                                     {:type :invalid-segment-terminator})))
                   (reset! terminator* terminator)))
               (consume-complete-segments!)
               (recur (+ position bytes-read))))))
       (finally
         (.closeSync fs fd))))))

(defn write-text
  "Write UTF-8 text to disk via Node.js fs."
  [path text]
  (.writeFileSync (js/require "fs") path text "utf8"))

(defn to-edn-text
  "Render data as pretty EDN text."
  [data]
  (with-out-str (pprint/pprint data)))