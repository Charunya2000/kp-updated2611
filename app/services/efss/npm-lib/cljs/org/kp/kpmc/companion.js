// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.companion');
goog.require('cljs.core');
goog.require('clojure.string');
goog.require('org.kp.kpmc.io_node');
org.kp.kpmc.companion.csv_quote_state_after_line = (function org$kp$kpmc$companion$csv_quote_state_after_line(line,initially_in_quote_QMARK_){
var chars = cljs.core.seq.call(null,line);
var in_quote_QMARK_ = initially_in_quote_QMARK_;
while(true){
if(cljs.core.empty_QMARK_.call(null,chars)){
return in_quote_QMARK_;
} else {
var current = cljs.core.first.call(null,chars);
var next_char = cljs.core.second.call(null,chars);
if(cljs.core.truth_((function (){var and__5140__auto__ = in_quote_QMARK_;
if(cljs.core.truth_(and__5140__auto__)){
return ((cljs.core._EQ_.call(null,current,"\"")) && (cljs.core._EQ_.call(null,next_char,"\"")));
} else {
return and__5140__auto__;
}
})())){
var G__2064 = cljs.core.nnext.call(null,chars);
var G__2065 = true;
chars = G__2064;
in_quote_QMARK_ = G__2065;
continue;
} else {
if(cljs.core._EQ_.call(null,current,"\"")){
var G__2066 = cljs.core.next.call(null,chars);
var G__2067 = cljs.core.not.call(null,in_quote_QMARK_);
chars = G__2066;
in_quote_QMARK_ = G__2067;
continue;
} else {
var G__2068 = cljs.core.next.call(null,chars);
var G__2069 = in_quote_QMARK_;
chars = G__2068;
in_quote_QMARK_ = G__2069;
continue;

}
}
}
break;
}
});
/**
 * Join physical CSV lines while retaining the one-based starting source row.
 */
org.kp.kpmc.companion.join_multiline_quoted_fields_with_source = (function org$kp$kpmc$companion$join_multiline_quoted_fields_with_source(text){
var raw_lines = cljs.core.map_indexed.call(null,(function (idx,line){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"text","text",-1790561697),line,new cljs.core.Keyword(null,"source-row","source-row",1358263732),(idx + (1))], null);
}),clojure.string.split_lines.call(null,text));
var result = cljs.core.PersistentVector.EMPTY;
var accumulator = null;
var source_row = null;
var in_quote_QMARK_ = false;
while(true){
if(cljs.core.empty_QMARK_.call(null,raw_lines)){
if(cljs.core.truth_(accumulator)){
return cljs.core.conj.call(null,result,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"text","text",-1790561697),accumulator,new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row], null));
} else {
return result;
}
} else {
var map__2071 = cljs.core.first.call(null,raw_lines);
var map__2071__$1 = cljs.core.__destructure_map.call(null,map__2071);
var raw_line = map__2071__$1;
var text__$1 = cljs.core.get.call(null,map__2071__$1,new cljs.core.Keyword(null,"text","text",-1790561697));
var line = text__$1;
var still_open_QMARK_ = org.kp.kpmc.companion.csv_quote_state_after_line.call(null,line,in_quote_QMARK_);
if(in_quote_QMARK_){
var merged = (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(accumulator)+"\n"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(line));
if(cljs.core.truth_(still_open_QMARK_)){
var G__2072 = cljs.core.rest.call(null,raw_lines);
var G__2073 = result;
var G__2074 = merged;
var G__2075 = source_row;
var G__2076 = true;
raw_lines = G__2072;
result = G__2073;
accumulator = G__2074;
source_row = G__2075;
in_quote_QMARK_ = G__2076;
continue;
} else {
var G__2077 = cljs.core.rest.call(null,raw_lines);
var G__2078 = cljs.core.conj.call(null,result,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"text","text",-1790561697),merged,new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row], null));
var G__2079 = null;
var G__2080 = null;
var G__2081 = false;
raw_lines = G__2077;
result = G__2078;
accumulator = G__2079;
source_row = G__2080;
in_quote_QMARK_ = G__2081;
continue;
}
} else {
if(cljs.core.truth_(still_open_QMARK_)){
var G__2082 = cljs.core.rest.call(null,raw_lines);
var G__2083 = result;
var G__2084 = line;
var G__2085 = new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(raw_line);
var G__2086 = true;
raw_lines = G__2082;
result = G__2083;
accumulator = G__2084;
source_row = G__2085;
in_quote_QMARK_ = G__2086;
continue;
} else {
var G__2087 = cljs.core.rest.call(null,raw_lines);
var G__2088 = cljs.core.conj.call(null,result,raw_line);
var G__2089 = null;
var G__2090 = null;
var G__2091 = false;
raw_lines = G__2087;
result = G__2088;
accumulator = G__2089;
source_row = G__2090;
in_quote_QMARK_ = G__2091;
continue;
}
}
}
break;
}
});
/**
 * Pre-process raw CSV text: join lines that are inside a quoted field.
 */
org.kp.kpmc.companion.join_multiline_quoted_fields = (function org$kp$kpmc$companion$join_multiline_quoted_fields(text){
return cljs.core.mapv.call(null,new cljs.core.Keyword(null,"text","text",-1790561697),org.kp.kpmc.companion.join_multiline_quoted_fields_with_source.call(null,text));
});
/**
 * Parse a single logical CSV line, respecting quoted fields that may contain commas.
 */
org.kp.kpmc.companion.parse_csv_line = (function org$kp$kpmc$companion$parse_csv_line(line){
var chars = cljs.core.seq.call(null,line);
var fields = cljs.core.PersistentVector.EMPTY;
var current = cljs.core.PersistentVector.EMPTY;
var in_quote_QMARK_ = false;
while(true){
if(cljs.core.empty_QMARK_.call(null,chars)){
return cljs.core.conj.call(null,fields,cljs.core.apply.call(null,cljs.core.str,current));
} else {
var c = cljs.core.first.call(null,chars);
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core._EQ_.call(null,c,"\"");
if(and__5140__auto__){
var and__5140__auto____$1 = in_quote_QMARK_;
if(cljs.core.truth_(and__5140__auto____$1)){
return cljs.core._EQ_.call(null,cljs.core.second.call(null,chars),"\"");
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
var G__2092 = cljs.core.nnext.call(null,chars);
var G__2093 = fields;
var G__2094 = cljs.core.conj.call(null,current,"\"");
var G__2095 = true;
chars = G__2092;
fields = G__2093;
current = G__2094;
in_quote_QMARK_ = G__2095;
continue;
} else {
if(((cljs.core._EQ_.call(null,c,"\"")) && (cljs.core.not.call(null,in_quote_QMARK_)))){
var G__2096 = cljs.core.rest.call(null,chars);
var G__2097 = fields;
var G__2098 = current;
var G__2099 = true;
chars = G__2096;
fields = G__2097;
current = G__2098;
in_quote_QMARK_ = G__2099;
continue;
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core._EQ_.call(null,c,"\"");
if(and__5140__auto__){
return in_quote_QMARK_;
} else {
return and__5140__auto__;
}
})())){
var G__2100 = cljs.core.rest.call(null,chars);
var G__2101 = fields;
var G__2102 = current;
var G__2103 = false;
chars = G__2100;
fields = G__2101;
current = G__2102;
in_quote_QMARK_ = G__2103;
continue;
} else {
if(((cljs.core._EQ_.call(null,c,",")) && (cljs.core.not.call(null,in_quote_QMARK_)))){
var G__2104 = cljs.core.rest.call(null,chars);
var G__2105 = cljs.core.conj.call(null,fields,cljs.core.apply.call(null,cljs.core.str,current));
var G__2106 = cljs.core.PersistentVector.EMPTY;
var G__2107 = false;
chars = G__2104;
fields = G__2105;
current = G__2106;
in_quote_QMARK_ = G__2107;
continue;
} else {
var G__2108 = cljs.core.rest.call(null,chars);
var G__2109 = fields;
var G__2110 = cljs.core.conj.call(null,current,c);
var G__2111 = in_quote_QMARK_;
chars = G__2108;
fields = G__2109;
current = G__2110;
in_quote_QMARK_ = G__2111;
continue;

}
}
}
}
}
break;
}
});
/**
 * Parse a loop header row from companion guide CSV.
 */
org.kp.kpmc.companion.parse_loop_header = (function org$kp$kpmc$companion$parse_loop_header(header_text){
var trimmed = clojure.string.trim.call(null,header_text);
var extract_requirement = (function (desc){
var req_match = cljs.core.re_find.call(null,/\s*\((Required|Situational)\)\*?\s*$/,desc);
if(cljs.core.truth_(req_match)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"description","description",-1428560544),clojure.string.trim.call(null,clojure.string.replace.call(null,desc,/\s*\((Required|Situational)\)\*?\s*$/,"")),new cljs.core.Keyword(null,"requirement","requirement",-928590335),(function (){var G__2112 = cljs.core.second.call(null,req_match);
switch (G__2112) {
case "Required":
return new cljs.core.Keyword(null,"required","required",1807647006);

break;
case "Situational":
return new cljs.core.Keyword(null,"situational","situational",-374859609);

break;
default:
return null;

}
})()], null);
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"description","description",-1428560544),desc,new cljs.core.Keyword(null,"requirement","requirement",-928590335),null], null);
}
});
var loop_match = cljs.core.re_find.call(null,/Loop:\s+(\S+)\s+Segment:\s+(\S+)\s+(.*)/,trimmed);
var loop_only = (cljs.core.truth_(loop_match)?null:cljs.core.re_find.call(null,/Loop:\s+(\S+)\s+(.*)/,trimmed));
if(cljs.core.truth_(loop_match)){
var map__2113 = extract_requirement.call(null,clojure.string.trim.call(null,cljs.core.nth.call(null,loop_match,(3))));
var map__2113__$1 = cljs.core.__destructure_map.call(null,map__2113);
var description = cljs.core.get.call(null,map__2113__$1,new cljs.core.Keyword(null,"description","description",-1428560544));
var requirement = cljs.core.get.call(null,map__2113__$1,new cljs.core.Keyword(null,"requirement","requirement",-928590335));
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),clojure.string.trim.call(null,cljs.core.nth.call(null,loop_match,(1))),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),clojure.string.trim.call(null,cljs.core.nth.call(null,loop_match,(2))),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),description,new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),requirement], null);
} else {
if(cljs.core.truth_(loop_only)){
var map__2114 = extract_requirement.call(null,clojure.string.trim.call(null,cljs.core.nth.call(null,loop_only,(2))));
var map__2114__$1 = cljs.core.__destructure_map.call(null,map__2114);
var description = cljs.core.get.call(null,map__2114__$1,new cljs.core.Keyword(null,"description","description",-1428560544));
var requirement = cljs.core.get.call(null,map__2114__$1,new cljs.core.Keyword(null,"requirement","requirement",-928590335));
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),clojure.string.trim.call(null,cljs.core.nth.call(null,loop_only,(1))),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),null,new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),description,new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),requirement], null);
} else {
return null;
}
}
});
/**
 * Parse companion guide CSV text into a normalized EDN map.
 */
org.kp.kpmc.companion.parse_companion_guide_text = (function org$kp$kpmc$companion$parse_companion_guide_text(csv_text){
var lines = cljs.core.map.call(null,org.kp.kpmc.companion.parse_csv_line,org.kp.kpmc.companion.join_multiline_quoted_fields.call(null,csv_text));
var meaningful_QMARK_ = (function (row){
return ((cljs.core.seq.call(null,row)) && ((!(clojure.string.blank_QMARK_.call(null,cljs.core.first.call(null,row))))));
});
var meaningful_lines = cljs.core.filter.call(null,meaningful_QMARK_,lines);
var loop_header_QMARK_ = (function (row){
return ((cljs.core.seq.call(null,row)) && (clojure.string.starts_with_QMARK_.call(null,clojure.string.trim.call(null,cljs.core.first.call(null,row)),"Loop:")));
});
var loop_sections = cljs.core.partition_by.call(null,loop_header_QMARK_,meaningful_lines);
var parse_element = (function (row){
var seg_name = clojure.string.trim.call(null,cljs.core.nth.call(null,row,(0),""));
var ref_des = clojure.string.trim.call(null,cljs.core.nth.call(null,row,(1),""));
var usage_raw = clojure.string.trim.call(null,cljs.core.nth.call(null,row,(2),""));
var kp_element = clojure.string.trim.call(null,cljs.core.nth.call(null,row,(3),""));
var elem_desc = clojure.string.trim.call(null,cljs.core.nth.call(null,row,(4),""));
if((((!(clojure.string.blank_QMARK_.call(null,ref_des)))) && (cljs.core.not_EQ_.call(null,ref_des,"Ref. Des.")))){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"segment-name","segment-name",532881788),seg_name,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),ref_des,new cljs.core.Keyword(null,"usage","usage",-1583752910),(function (){var G__2116 = usage_raw;
switch (G__2116) {
case "R":
return new cljs.core.Keyword(null,"required","required",1807647006);

break;
case "S":
return new cljs.core.Keyword(null,"situational","situational",-374859609);

break;
case "Not Used":
return new cljs.core.Keyword(null,"not-used","not-used",-330157808);

break;
default:
return cljs.core.keyword.call(null,clojure.string.lower_case.call(null,clojure.string.replace.call(null,usage_raw," ","-")));

}
})(),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),kp_element,new cljs.core.Keyword(null,"element-description","element-description",1941111197),elem_desc], null);
} else {
return null;
}
});
var build_loops = (function (sections){
var remaining = sections;
var result = cljs.core.PersistentVector.EMPTY;
while(true){
if(cljs.core.empty_QMARK_.call(null,remaining)){
return result;
} else {
var section = cljs.core.first.call(null,remaining);
if(loop_header_QMARK_.call(null,cljs.core.first.call(null,section))){
var header_info = org.kp.kpmc.companion.parse_loop_header.call(null,cljs.core.first.call(null,cljs.core.first.call(null,section)));
var data_section = cljs.core.second.call(null,remaining);
var elements = (cljs.core.truth_(data_section)?cljs.core.vec.call(null,cljs.core.remove.call(null,cljs.core.nil_QMARK_,cljs.core.map.call(null,parse_element,data_section))):null);
var G__2118 = cljs.core.drop.call(null,(2),remaining);
var G__2119 = cljs.core.conj.call(null,result,cljs.core.merge.call(null,header_info,new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"elements","elements",657646735),(function (){var or__5142__auto__ = elements;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentVector.EMPTY;
}
})()], null)));
remaining = G__2118;
result = G__2119;
continue;
} else {
var G__2120 = cljs.core.rest.call(null,remaining);
var G__2121 = result;
remaining = G__2120;
result = G__2121;
continue;
}
}
break;
}
});
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"loops","loops",-1766681555),build_loops.call(null,loop_sections)], null);
});
/**
 * Parse companion guide CSV file path into EDN map.
 */
org.kp.kpmc.companion.parse_companion_guide = (function org$kp$kpmc$companion$parse_companion_guide(csv_file){
return org.kp.kpmc.companion.parse_companion_guide_text.call(null,org.kp.kpmc.io_node.read_text.call(null,csv_file));
});
/**
 * Return parsed companion guide data and pretty EDN text; caller handles writing.
 */
org.kp.kpmc.companion.save_companion_guide_edn = (function org$kp$kpmc$companion$save_companion_guide_edn(csv_file){
var schema = org.kp.kpmc.companion.parse_companion_guide.call(null,csv_file);
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"schema","schema",-1582001791),schema,new cljs.core.Keyword(null,"edn-text","edn-text",-2069322458),org.kp.kpmc.io_node.to_edn_text.call(null,schema)], null);
});
/**
 * Parse segment reference like NM101 into {:segment-id "NM1" :position n}.
 */
org.kp.kpmc.companion.parse_segment_ref = (function org$kp$kpmc$companion$parse_segment_ref(ref){
if(cljs.core.truth_((function (){var and__5140__auto__ = ref;
if(cljs.core.truth_(and__5140__auto__)){
return (cljs.core.count.call(null,ref) >= (3));
} else {
return and__5140__auto__;
}
})())){
var pos_str = cljs.core.subs.call(null,ref,(cljs.core.count.call(null,ref) - (2)));
var seg_id = cljs.core.subs.call(null,ref,(0),(cljs.core.count.call(null,ref) - (2)));
var pos = parseInt(pos_str,(10));
if(isNaN(pos)){
return null;
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),seg_id,new cljs.core.Keyword(null,"position","position",-2011731912),pos], null);
}
} else {
return null;
}
});

//# sourceMappingURL=companion.js.map
