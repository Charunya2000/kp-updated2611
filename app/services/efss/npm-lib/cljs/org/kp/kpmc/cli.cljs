(ns org.kp.kpmc.cli
  (:require [clojure.string :as str]
            [cljs.reader :as reader]
            [org.kp.kpmc.io-node :as io]
            [org.kp.kpmc.parser :as parser]
            [org.kp.kpmc.enrich :as enrich]
            [org.kp.kpmc.mapping-export :as mapping-export]))

(defn parse-cli-opts
  "Parse simple --key value CLI pairs into an option map."
  [args]
  (loop [remaining args
         opts {}]
    (if (empty? remaining)
      opts
      (let [k (first remaining)]
        (cond
          (= k "--help") (assoc opts :help true)
          (and (str/starts-with? k "--") (second remaining))
          (recur (nnext remaining)
                 (assoc opts (keyword (subs k 2)) (second remaining)))
          :else
          (recur (rest remaining) opts))))))

(defn cli-usage
  []
  (str
   "Usage:\n"
   "  --mode parse-full --input <x12-file> --output <edn-file>\n"
   "  --mode parse-chunked --input <x12-file> --output <edn-file>\n"
   "  --mode enrich-edn --parse-edn <input-edn> --companion <companion-edn> --output <edn-file>\n"
   "  --mode parse-and-enrich --input <x12-file> --companion <companion-edn> --output <edn-file>\n"
  "  --mode generate-lookup-specs --input <mapping-edn> --output <lookup-edn>\n"
   "\n"
   "Examples:\n"
   "  --mode parse-full --input src/main/resources/edisamples/test1.txt --output out/full.edn\n"
   "  --mode parse-and-enrich --input src/main/resources/edisamples/test1.txt --companion src/main/resources/TrentonSystemsInc_GA_CompanionDoc_5010a1-2025-12-29.edn --output out/enriched.edn\n"))

(defn require-opt
  [opts k]
  (or (get opts k)
      (throw (ex-info (str "Missing required option: " (name k))
                      {:error :missing-option :option k :opts opts}))))

(defn parse-bool
  [v]
  (contains? #{"1" "true" "yes" "on"} (str/lower-case (str v))))

(defn run-cli!
  "Execute CLI operation and return {:mode ... :output ... :result ...}."
  [opts]
  (let [mode (keyword (or (:mode opts) ""))
        output (require-opt opts :output)
        parse-opts (cond-> {}
                     (contains? opts :log-memory)
                     (assoc :log-memory? (parse-bool (:log-memory opts)))

                     (contains? opts :log-every-n-subscribers)
                     (assoc :log-every-n-subscribers
                            (js/parseInt (str (:log-every-n-subscribers opts)) 10)))]
    (case mode
      :parse-full
      (let [input (require-opt opts :input)
            result (parser/parse-x12-full input parse-opts)]
        (io/write-text output (io/to-edn-text result))
        {:mode mode :output output :result result})

      :parse-chunked
      (let [input (require-opt opts :input)
            result (parser/parse-x12-chunked input parse-opts)]
        (io/write-text output (io/to-edn-text result))
        {:mode mode :output output :result result})

      :enrich-edn
      (let [parse-edn (require-opt opts :parse-edn)
            companion-edn (require-opt opts :companion)
            result (enrich/enrich-x12-with-companion-guide parse-edn companion-edn)]
        (io/write-text output (io/to-edn-text result))
        {:mode mode :output output :result result})

      :parse-and-enrich
      (let [input (require-opt opts :input)
            companion-edn (require-opt opts :companion)
            parsed (parser/parse-x12-full input)
            companion-guide (reader/read-string (io/read-text companion-edn))
            result (enrich/enrich-parse-tree parsed companion-guide)]
        (io/write-text output (io/to-edn-text result))
        {:mode mode :output output :result result})

        :generate-lookup-specs
        (let [input (require-opt opts :input)
          result (mapping-export/write-lookup-specs! input output)]
          {:mode mode :output output :result result})

      (throw (ex-info "Invalid or missing --mode"
                      {:error :invalid-mode
                       :mode (:mode opts)
                 :allowed [:parse-full :parse-chunked :enrich-edn :parse-and-enrich
                   :generate-lookup-specs]})))))

(defn -main
  "Node CLI entrypoint for parse/enrich operations."
  [& args]
  (let [opts (parse-cli-opts args)]
    (if (:help opts)
      (do
        (println (cli-usage))
        (.exit js/process 0))
      (try
        (let [{:keys [mode output]} (run-cli! opts)]
          (println (str "Completed " (name mode) ". Wrote " output))
          (.exit js/process 0))
        (catch :default e
          (println "CLI error:" (.-message e))
          (when-let [data (ex-data e)]
            (println (io/to-edn-text data)))
          (println (cli-usage))
          (.exit js/process 1))))))