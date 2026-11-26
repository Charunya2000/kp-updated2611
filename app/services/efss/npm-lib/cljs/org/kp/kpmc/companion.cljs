(ns org.kp.kpmc.companion
  (:require [clojure.string :as str]
            [org.kp.kpmc.io-node :as io]))

(defn- csv-quote-state-after-line
  [line initially-in-quote?]
  (loop [chars (seq line)
         in-quote? initially-in-quote?]
    (if (empty? chars)
      in-quote?
      (let [current (first chars)
            next-char (second chars)]
        (cond
          (and in-quote? (= current \") (= next-char \"))
          (recur (nnext chars) true)

          (= current \")
          (recur (next chars) (not in-quote?))

          :else
          (recur (next chars) in-quote?))))))

(defn join-multiline-quoted-fields-with-source
  "Join physical CSV lines while retaining the one-based starting source row."
  [text]
  (loop [raw-lines (map-indexed (fn [idx line]
                                  {:text line :source-row (inc idx)})
                                (str/split-lines text))
         result []
         accumulator nil
         source-row nil
         in-quote? false]
    (if (empty? raw-lines)
      (if accumulator
        (conj result {:text accumulator :source-row source-row})
        result)
      (let [{:keys [text] :as raw-line} (first raw-lines)
            line text
            still-open? (csv-quote-state-after-line line in-quote?)]
        (if in-quote?
          (let [merged (str accumulator "\n" line)]
            (if still-open?
              (recur (rest raw-lines) result merged source-row true)
              (recur (rest raw-lines)
                     (conj result {:text merged :source-row source-row})
                     nil nil false)))
          (if still-open?
            (recur (rest raw-lines) result line (:source-row raw-line) true)
            (recur (rest raw-lines)
                   (conj result raw-line)
                   nil nil false)))))))

(defn join-multiline-quoted-fields
  "Pre-process raw CSV text: join lines that are inside a quoted field."
  [text]
  (mapv :text (join-multiline-quoted-fields-with-source text)))

(defn parse-csv-line
  "Parse a single logical CSV line, respecting quoted fields that may contain commas."
  [line]
  (loop [chars (seq line)
         fields []
         current []
         in-quote? false]
    (if (empty? chars)
      (conj fields (apply str current))
      (let [c (first chars)]
        (cond
          (and (= c \") in-quote? (= (second chars) \"))
          (recur (nnext chars) fields (conj current \") true)

          (and (= c \") (not in-quote?))
          (recur (rest chars) fields current true)

          (and (= c \") in-quote?)
          (recur (rest chars) fields current false)

          (and (= c \,) (not in-quote?))
          (recur (rest chars) (conj fields (apply str current)) [] false)

          :else
          (recur (rest chars) fields (conj current c) in-quote?))))))

(defn parse-loop-header
  "Parse a loop header row from companion guide CSV."
  [header-text]
  (let [trimmed (str/trim header-text)
        extract-requirement
        (fn [desc]
          (let [req-match (re-find #"\s*\((Required|Situational)\)\*?\s*$" desc)]
            (if req-match
              {:description (str/trim (str/replace desc #"\s*\((Required|Situational)\)\*?\s*$" ""))
               :requirement (case (second req-match)
                              "Required" :required
                              "Situational" :situational
                              nil)}
              {:description desc :requirement nil})))
        loop-match (re-find #"Loop:\s+(\S+)\s+Segment:\s+(\S+)\s+(.*)" trimmed)
        loop-only (when-not loop-match
                    (re-find #"Loop:\s+(\S+)\s+(.*)" trimmed))]
    (if loop-match
      (let [{:keys [description requirement]} (extract-requirement (str/trim (nth loop-match 3)))]
        {:loop-name (str/trim (nth loop-match 1))
         :segment-id (str/trim (nth loop-match 2))
         :segment-description description
         :segment-requirement requirement})
      (when loop-only
        (let [{:keys [description requirement]} (extract-requirement (str/trim (nth loop-only 2)))]
          {:loop-name (str/trim (nth loop-only 1))
           :segment-id nil
           :segment-description description
           :segment-requirement requirement})))))

(defn parse-companion-guide-text
  "Parse companion guide CSV text into a normalized EDN map."
  [csv-text]
  (let [lines (->> csv-text
                   join-multiline-quoted-fields
                   (map parse-csv-line))
        meaningful? (fn [row]
                      (and (seq row)
                           (not (str/blank? (first row)))))
        meaningful-lines (filter meaningful? lines)
        loop-header? (fn [row]
                       (and (seq row)
                            (str/starts-with? (str/trim (first row)) "Loop:")))
        loop-sections (partition-by loop-header? meaningful-lines)
        parse-element
        (fn [row]
          (let [seg-name (str/trim (nth row 0 ""))
                ref-des (str/trim (nth row 1 ""))
                usage-raw (str/trim (nth row 2 ""))
                kp-element (str/trim (nth row 3 ""))
                elem-desc (str/trim (nth row 4 ""))]
            (when (and (not (str/blank? ref-des))
                       (not= ref-des "Ref. Des."))
              {:segment-name seg-name
               :segment-ref ref-des
               :usage (case usage-raw
                        "R" :required
                        "S" :situational
                        "Not Used" :not-used
                        (keyword (str/lower-case (str/replace usage-raw " " "-"))))
               :kp-element kp-element
               :element-description elem-desc})))
        build-loops
        (fn [sections]
          (loop [remaining sections
                 result []]
            (if (empty? remaining)
              result
              (let [section (first remaining)]
                (if (loop-header? (first section))
                  (let [header-info (parse-loop-header (first (first section)))
                        data-section (second remaining)
                        elements (when data-section
                                   (->> data-section
                                        (map parse-element)
                                        (remove nil?)
                                        vec))]
                    (recur (drop 2 remaining)
                           (conj result (merge header-info {:elements (or elements [])}))))
                  (recur (rest remaining) result))))))]
    {:loops (build-loops loop-sections)}))

(defn parse-companion-guide
  "Parse companion guide CSV file path into EDN map."
  [csv-file]
  (parse-companion-guide-text (io/read-text csv-file)))

(defn save-companion-guide-edn
  "Return parsed companion guide data and pretty EDN text; caller handles writing."
  [csv-file]
  (let [schema (parse-companion-guide csv-file)]
    {:schema schema
     :edn-text (io/to-edn-text schema)}))

(defn parse-segment-ref
  "Parse segment reference like NM101 into {:segment-id \"NM1\" :position n}."
  [ref]
  (when (and ref (>= (count ref) 3))
    (let [pos-str (subs ref (- (count ref) 2))
          seg-id (subs ref 0 (- (count ref) 2))
          pos (js/parseInt pos-str 10)]
      (when-not (js/isNaN pos)
        {:segment-id seg-id
         :position pos}))))