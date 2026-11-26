// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.companion_rules');
goog.require('cljs.core');
goog.require('cljs.reader');
goog.require('clojure.string');
goog.require('org.kp.kpmc.companion');
goog.require('org.kp.kpmc.io_node');
goog.require('org.kp.kpmc.parser');
org.kp.kpmc.companion_rules.blankish_QMARK_ = (function org$kp$kpmc$companion_rules$blankish_QMARK_(s){
return (((s == null)) || (clojure.string.blank_QMARK_.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(s)))));
});
org.kp.kpmc.companion_rules.tag_name = (function org$kp$kpmc$companion_rules$tag_name(x){
if((x instanceof cljs.core.Keyword)){
return cljs.core.name.call(null,x);
} else {
if(typeof x === 'string'){
return x;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(x));

}
}
});
org.kp.kpmc.companion_rules.tag_EQ_ = (function org$kp$kpmc$companion_rules$tag_EQ_(node,t){
return ((cljs.core.sequential_QMARK_.call(null,node)) && (cljs.core._EQ_.call(null,org.kp.kpmc.companion_rules.tag_name.call(null,cljs.core.first.call(null,node)),t)));
});
org.kp.kpmc.companion_rules.normalize_usage = (function org$kp$kpmc$companion_rules$normalize_usage(raw){
var v = clojure.string.trim.call(null,(function (){var or__5142__auto__ = raw;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
var G__1922 = v;
switch (G__1922) {
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
return new cljs.core.Keyword(null,"unknown","unknown",-935977881);

}
});
org.kp.kpmc.companion_rules.editable_companion_guide_schema_version = (1);
org.kp.kpmc.companion_rules.diagnostic = (function org$kp$kpmc$companion_rules$diagnostic(severity,code,message,row,field,source_value){
var G__1924 = new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"severity","severity",175684886),severity,new cljs.core.Keyword(null,"code","code",1586293142),code,new cljs.core.Keyword(null,"message","message",-406056002),message], null);
var G__1924__$1 = (cljs.core.truth_(new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(row))?cljs.core.assoc.call(null,G__1924,new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(row)):G__1924);
var G__1924__$2 = (cljs.core.truth_(new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(row))?cljs.core.assoc.call(null,G__1924__$1,new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(row)):G__1924__$1);
var G__1924__$3 = (cljs.core.truth_(field)?cljs.core.assoc.call(null,G__1924__$2,new cljs.core.Keyword(null,"field","field",-1302436500),field):G__1924__$2);
if((!((source_value == null)))){
return cljs.core.assoc.call(null,G__1924__$3,new cljs.core.Keyword(null,"source-value","source-value",76131443),source_value);
} else {
return G__1924__$3;
}
});
org.kp.kpmc.companion_rules.zero_pad2 = (function org$kp$kpmc$companion_rules$zero_pad2(n){
if((n < (10))){
return (""+"0"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(n));
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(n));
}
});
/**
 * Parse companion guide CSV into a rich model with legend, loops, and rows.
 * Handles continuation option rows where cols A/B are blank.
 */
org.kp.kpmc.companion_rules.parse_companion_csv__GT_model = (function org$kp$kpmc$companion_rules$parse_companion_csv__GT_model(csv_text){
var rows = cljs.core.vec.call(null,cljs.core.map.call(null,(function (p__1925){
var map__1926 = p__1925;
var map__1926__$1 = cljs.core.__destructure_map.call(null,map__1926);
var text = cljs.core.get.call(null,map__1926__$1,new cljs.core.Keyword(null,"text","text",-1790561697));
var source_row = cljs.core.get.call(null,map__1926__$1,new cljs.core.Keyword(null,"source-row","source-row",1358263732));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row,new cljs.core.Keyword(null,"values","values",372645556),cljs.core.subvec.call(null,cljs.core.vec.call(null,cljs.core.concat.call(null,org.kp.kpmc.companion.parse_csv_line.call(null,text),cljs.core.repeat.call(null,(5),""))),(0),(5))], null);
}),org.kp.kpmc.companion.join_multiline_quoted_fields_with_source.call(null,csv_text)));
var header_idx = cljs.core.first.call(null,cljs.core.keep_indexed.call(null,(function (idx,row){
if(cljs.core._EQ_.call(null,"Ref. Des.",clojure.string.trim.call(null,cljs.core.nth.call(null,new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(row),(1),"")))){
return idx;
} else {
return null;
}
}),rows));
var legend_rows = (cljs.core.truth_(header_idx)?cljs.core.subvec.call(null,rows,(0),header_idx):cljs.core.PersistentVector.EMPTY);
var body_rows = (cljs.core.truth_(header_idx)?cljs.core.subvec.call(null,rows,(header_idx + (1))):cljs.core.PersistentVector.EMPTY);
var legend_start = cljs.core.first.call(null,cljs.core.keep_indexed.call(null,(function (idx,row){
if(cljs.core._EQ_.call(null,"Legend",clojure.string.trim.call(null,cljs.core.nth.call(null,new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(row),(0),"")))){
return idx;
} else {
return null;
}
}),legend_rows));
var legend_pairs = (((legend_start == null))?cljs.core.PersistentVector.EMPTY:cljs.core.vec.call(null,cljs.core.filter.call(null,(function (p__1927){
var map__1928 = p__1927;
var map__1928__$1 = cljs.core.__destructure_map.call(null,map__1928);
var key = cljs.core.get.call(null,map__1928__$1,new cljs.core.Keyword(null,"key","key",-1516042587));
var value = cljs.core.get.call(null,map__1928__$1,new cljs.core.Keyword(null,"value","value",305978217));
return (((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,key)))) || ((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value)))));
}),cljs.core.map.call(null,(function (p__1929){
var map__1930 = p__1929;
var map__1930__$1 = cljs.core.__destructure_map.call(null,map__1930);
var values = cljs.core.get.call(null,map__1930__$1,new cljs.core.Keyword(null,"values","values",372645556));
var source_row = cljs.core.get.call(null,map__1930__$1,new cljs.core.Keyword(null,"source-row","source-row",1358263732));
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"row-id","row-id",246619473),(""+"legend-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(source_row)),new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row,new cljs.core.Keyword(null,"key","key",-1516042587),clojure.string.trim.call(null,cljs.core.nth.call(null,values,(0),"")),new cljs.core.Keyword(null,"value","value",305978217),clojure.string.trim.call(null,cljs.core.nth.call(null,values,(1),""))], null);
}),cljs.core.subvec.call(null,legend_rows,(legend_start + (1)))))));
var remaining = body_rows;
var current_loop = null;
var current_element = null;
var loops = cljs.core.PersistentVector.EMPTY;
var elements = cljs.core.PersistentVector.EMPTY;
var diagnostics = cljs.core.PersistentVector.EMPTY;
while(true){
if(cljs.core.empty_QMARK_.call(null,remaining)){
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"schema-version","schema-version",1117939594),org.kp.kpmc.companion_rules.editable_companion_guide_schema_version,new cljs.core.Keyword(null,"source","source",-433931539),new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"kind","kind",-717265803),"csv"], null),new cljs.core.Keyword(null,"legend","legend",-1027192245),legend_pairs,new cljs.core.Keyword(null,"loops","loops",-1766681555),loops,new cljs.core.Keyword(null,"elements","elements",657646735),(function (){var G__1941 = elements;
if(cljs.core.truth_(current_element)){
return cljs.core.conj.call(null,G__1941,current_element);
} else {
return G__1941;
}
})(),new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),diagnostics], null);
} else {
var map__1942 = cljs.core.first.call(null,remaining);
var map__1942__$1 = cljs.core.__destructure_map.call(null,map__1942);
var values = cljs.core.get.call(null,map__1942__$1,new cljs.core.Keyword(null,"values","values",372645556));
var source_row = cljs.core.get.call(null,map__1942__$1,new cljs.core.Keyword(null,"source-row","source-row",1358263732));
var vec__1943 = values;
var col_a = cljs.core.nth.call(null,vec__1943,(0),null);
var col_b = cljs.core.nth.call(null,vec__1943,(1),null);
var col_c = cljs.core.nth.call(null,vec__1943,(2),null);
var col_d = cljs.core.nth.call(null,vec__1943,(3),null);
var col_e = cljs.core.nth.call(null,vec__1943,(4),null);
var a = clojure.string.trim.call(null,col_a);
var b = clojure.string.trim.call(null,col_b);
var c = clojure.string.trim.call(null,col_c);
var d = clojure.string.trim.call(null,col_d);
var e = clojure.string.trim.call(null,col_e);
var loop_line_QMARK_ = clojure.string.starts_with_QMARK_.call(null,a,"Loop:");
var ref_row_QMARK_ = (!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,b)));
var cont_option_row_QMARK_ = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,a)) && (((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,b)) && ((((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,d)))) && ((!((current_element == null)))))))));
if(loop_line_QMARK_){
var parsed_loop = org.kp.kpmc.companion.parse_loop_header.call(null,a);
var next_loop = (cljs.core.truth_(parsed_loop)?cljs.core.assoc.call(null,parsed_loop,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),(""+"loop-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(source_row)),new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row):null);
var G__1951 = cljs.core.rest.call(null,remaining);
var G__1952 = next_loop;
var G__1953 = current_element;
var G__1954 = (cljs.core.truth_(next_loop)?cljs.core.conj.call(null,loops,next_loop):loops);
var G__1955 = elements;
var G__1956 = (function (){var G__1946 = diagnostics;
if((next_loop == null)){
return cljs.core.conj.call(null,G__1946,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"unrecognized-loop-header","unrecognized-loop-header",-1408893654),"Loop header could not be parsed.",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row], null),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),a));
} else {
return G__1946;
}
})();
remaining = G__1951;
current_loop = G__1952;
current_element = G__1953;
loops = G__1954;
elements = G__1955;
diagnostics = G__1956;
continue;
} else {
if(ref_row_QMARK_){
var next_element = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"label","label",1718410804),new cljs.core.Keyword(null,"options","options",99638489),new cljs.core.Keyword(null,"element-description","element-description",1941111197)],[d,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(current_loop),b,current_loop,(""+"element-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(source_row)),org.kp.kpmc.companion_rules.normalize_usage.call(null,c),source_row,a,cljs.core.PersistentVector.EMPTY,e]);
var next_diagnostics = (function (){var G__1947 = diagnostics;
var G__1947__$1 = ((cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"unknown","unknown",-935977881),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(next_element)))?cljs.core.conj.call(null,G__1947,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"warning","warning",-1685650671),new cljs.core.Keyword(null,"unknown-usage","unknown-usage",-641037366),"Usage value was not recognized.",next_element,new cljs.core.Keyword(null,"usage","usage",-1583752910),c)):G__1947);
var G__1947__$2 = (((org.kp.kpmc.companion.parse_segment_ref.call(null,b) == null))?cljs.core.conj.call(null,G__1947__$1,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"invalid-segment-ref","invalid-segment-ref",-1512204437),"Segment reference could not be parsed.",next_element,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),b)):G__1947__$1);
if((current_loop == null)){
return cljs.core.conj.call(null,G__1947__$2,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"warning","warning",-1685650671),new cljs.core.Keyword(null,"missing-loop","missing-loop",-262679776),"Element is not associated with a parsed loop.",next_element,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),null));
} else {
return G__1947__$2;
}
})();
var G__1957 = cljs.core.rest.call(null,remaining);
var G__1958 = current_loop;
var G__1959 = next_element;
var G__1960 = loops;
var G__1961 = (function (){var G__1948 = elements;
if(cljs.core.truth_(current_element)){
return cljs.core.conj.call(null,G__1948,current_element);
} else {
return G__1948;
}
})();
var G__1962 = next_diagnostics;
remaining = G__1957;
current_loop = G__1958;
current_element = G__1959;
loops = G__1960;
elements = G__1961;
diagnostics = G__1962;
continue;
} else {
if(cont_option_row_QMARK_){
var opt = new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"row-id","row-id",246619473),(""+"option-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(source_row)),new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row,new cljs.core.Keyword(null,"usage","usage",-1583752910),org.kp.kpmc.companion_rules.normalize_usage.call(null,c),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),d,new cljs.core.Keyword(null,"element-description","element-description",1941111197),e], null);
var next_diagnostics = (function (){var G__1949 = diagnostics;
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"unknown","unknown",-935977881),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(opt))){
return cljs.core.conj.call(null,G__1949,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"warning","warning",-1685650671),new cljs.core.Keyword(null,"unknown-usage","unknown-usage",-641037366),"Usage value was not recognized.",opt,new cljs.core.Keyword(null,"usage","usage",-1583752910),c));
} else {
return G__1949;
}
})();
var G__1963 = cljs.core.rest.call(null,remaining);
var G__1964 = current_loop;
var G__1965 = cljs.core.update.call(null,current_element,new cljs.core.Keyword(null,"options","options",99638489),cljs.core.conj,opt);
var G__1966 = loops;
var G__1967 = elements;
var G__1968 = next_diagnostics;
remaining = G__1963;
current_loop = G__1964;
current_element = G__1965;
loops = G__1966;
elements = G__1967;
diagnostics = G__1968;
continue;
} else {
var nonblank_QMARK_ = cljs.core.some.call(null,cljs.core.complement.call(null,org.kp.kpmc.companion_rules.blankish_QMARK_),new cljs.core.PersistentVector(null, 5, 5, cljs.core.PersistentVector.EMPTY_NODE, [a,b,c,d,e], null));
var orphan_option_QMARK_ = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,a)) && (((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,b)) && ((((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,d)))) && ((current_element == null)))))));
var G__1969 = cljs.core.rest.call(null,remaining);
var G__1970 = current_loop;
var G__1971 = current_element;
var G__1972 = loops;
var G__1973 = elements;
var G__1974 = (function (){var G__1950 = diagnostics;
var G__1950__$1 = ((orphan_option_QMARK_)?cljs.core.conj.call(null,G__1950,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"orphan-option","orphan-option",486829356),"Continuation row has no preceding element.",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"row-id","row-id",246619473),(""+"option-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(source_row)),new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row], null),null,null)):G__1950);
if(cljs.core.truth_((function (){var and__5140__auto__ = nonblank_QMARK_;
if(cljs.core.truth_(and__5140__auto__)){
return (!(orphan_option_QMARK_));
} else {
return and__5140__auto__;
}
})())){
return cljs.core.conj.call(null,G__1950__$1,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"info","info",-317069002),new cljs.core.Keyword(null,"ignored-row","ignored-row",1158508818),"Row is not part of the supported guide structure.",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"source-row","source-row",1358263732),source_row], null),null,null));
} else {
return G__1950__$1;
}
})();
remaining = G__1969;
current_loop = G__1970;
current_element = G__1971;
loops = G__1972;
elements = G__1973;
diagnostics = G__1974;
continue;

}
}
}
}
break;
}
});
org.kp.kpmc.companion_rules.public_field_name = (function org$kp$kpmc$companion_rules$public_field_name(field){
return cljs.core.get.call(null,new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),"loopId",new cljs.core.Keyword(null,"row-id","row-id",246619473),"rowId",new cljs.core.Keyword(null,"schema-version","schema-version",1117939594),"schemaVersion",new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),"segmentRef",new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),"segmentRequirement",new cljs.core.Keyword(null,"source-row","source-row",1358263732),"sourceRow",new cljs.core.Keyword(null,"source-value","source-value",76131443),"sourceValue"], null),field,(function (){var G__1975 = field;
if((G__1975 == null)){
return null;
} else {
return cljs.core.name.call(null,G__1975);
}
})());
});
org.kp.kpmc.companion_rules.diagnostic__GT_public = (function org$kp$kpmc$companion_rules$diagnostic__GT_public(item){
var G__1976 = new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"severity","severity",175684886),cljs.core.name.call(null,new cljs.core.Keyword(null,"severity","severity",175684886).cljs$core$IFn$_invoke$arity$1(item)),new cljs.core.Keyword(null,"code","code",1586293142),cljs.core.name.call(null,new cljs.core.Keyword(null,"code","code",1586293142).cljs$core$IFn$_invoke$arity$1(item)),new cljs.core.Keyword(null,"message","message",-406056002),new cljs.core.Keyword(null,"message","message",-406056002).cljs$core$IFn$_invoke$arity$1(item)], null);
var G__1976__$1 = (cljs.core.truth_(new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(item))?cljs.core.assoc.call(null,G__1976,new cljs.core.Keyword(null,"rowId","rowId",632540453),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(item)):G__1976);
var G__1976__$2 = (cljs.core.truth_(new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(item))?cljs.core.assoc.call(null,G__1976__$1,new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(item)):G__1976__$1);
var G__1976__$3 = (cljs.core.truth_(new cljs.core.Keyword(null,"field","field",-1302436500).cljs$core$IFn$_invoke$arity$1(item))?cljs.core.assoc.call(null,G__1976__$2,new cljs.core.Keyword(null,"field","field",-1302436500),org.kp.kpmc.companion_rules.public_field_name.call(null,new cljs.core.Keyword(null,"field","field",-1302436500).cljs$core$IFn$_invoke$arity$1(item))):G__1976__$2);
if(cljs.core.contains_QMARK_.call(null,item,new cljs.core.Keyword(null,"source-value","source-value",76131443))){
return cljs.core.assoc.call(null,G__1976__$3,new cljs.core.Keyword(null,"sourceValue","sourceValue",1313156611),new cljs.core.Keyword(null,"source-value","source-value",76131443).cljs$core$IFn$_invoke$arity$1(item));
} else {
return G__1976__$3;
}
});
org.kp.kpmc.companion_rules.model__GT_editable_document = (function org$kp$kpmc$companion_rules$model__GT_editable_document(model,source_name){
return new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"schemaVersion","schemaVersion",983417854),org.kp.kpmc.companion_rules.editable_companion_guide_schema_version,new cljs.core.Keyword(null,"source","source",-433931539),(function (){var G__1977 = new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"kind","kind",-717265803),"csv"], null);
if((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,source_name)))){
return cljs.core.assoc.call(null,G__1977,new cljs.core.Keyword(null,"name","name",1843675177),source_name);
} else {
return G__1977;
}
})(),new cljs.core.Keyword(null,"columns","columns",1998437288),new cljs.core.PersistentVector(null, 5, 5, cljs.core.PersistentVector.EMPTY_NODE, ["segmentName","segmentRef","usage","kpElement","elementDescription"], null),new cljs.core.Keyword(null,"legend","legend",-1027192245),cljs.core.mapv.call(null,(function (entry){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"rowId","rowId",632540453),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(entry),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(entry),new cljs.core.Keyword(null,"key","key",-1516042587),new cljs.core.Keyword(null,"key","key",-1516042587).cljs$core$IFn$_invoke$arity$1(entry),new cljs.core.Keyword(null,"value","value",305978217),new cljs.core.Keyword(null,"value","value",305978217).cljs$core$IFn$_invoke$arity$1(entry)], null);
}),new cljs.core.Keyword(null,"legend","legend",-1027192245).cljs$core$IFn$_invoke$arity$1(model)),new cljs.core.Keyword(null,"loops","loops",-1766681555),cljs.core.mapv.call(null,(function (loop_def){
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"loopId","loopId",-1022364733),new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"loopName","loopName",874146968),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segmentId","segmentId",207383330),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segmentDescription","segmentDescription",1540971248),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segmentRequirement","segmentRequirement",447073040),(function (){var G__1978 = new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(loop_def);
if((G__1978 == null)){
return null;
} else {
return cljs.core.name.call(null,G__1978);
}
})()], null);
}),new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(model)),new cljs.core.Keyword(null,"elements","elements",657646735),cljs.core.mapv.call(null,(function (element){
return cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"elementDescription","elementDescription",-418664671),new cljs.core.Keyword(null,"segmentName","segmentName",-1487668030),new cljs.core.Keyword(null,"loopId","loopId",-1022364733),new cljs.core.Keyword(null,"rowId","rowId",632540453),new cljs.core.Keyword(null,"segmentRef","segmentRef",-77913524),new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"kpElement","kpElement",-48302856),new cljs.core.Keyword(null,"options","options",99638489),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743)],[new cljs.core.Keyword(null,"element-description","element-description",1941111197).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"label","label",1718410804).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(element),cljs.core.name.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(element)),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(element),cljs.core.mapv.call(null,(function (option){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"rowId","rowId",632540453),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(option),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(option),new cljs.core.Keyword(null,"usage","usage",-1583752910),cljs.core.name.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(option)),new cljs.core.Keyword(null,"kpElement","kpElement",-48302856),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(option),new cljs.core.Keyword(null,"elementDescription","elementDescription",-418664671),new cljs.core.Keyword(null,"element-description","element-description",1941111197).cljs$core$IFn$_invoke$arity$1(option)], null);
}),new cljs.core.Keyword(null,"options","options",99638489).cljs$core$IFn$_invoke$arity$1(element)),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(element)]);
}),new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(model)),new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),cljs.core.mapv.call(null,org.kp.kpmc.companion_rules.diagnostic__GT_public,new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524).cljs$core$IFn$_invoke$arity$1(model))], null);
});
org.kp.kpmc.companion_rules.public_diagnostic__GT_internal = (function org$kp$kpmc$companion_rules$public_diagnostic__GT_internal(item){
var G__1979 = new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"severity","severity",175684886),cljs.core.keyword.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"severity","severity",175684886).cljs$core$IFn$_invoke$arity$1(item);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "info";
}
})()),new cljs.core.Keyword(null,"code","code",1586293142),cljs.core.keyword.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"code","code",1586293142).cljs$core$IFn$_invoke$arity$1(item);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "unknown";
}
})()),new cljs.core.Keyword(null,"message","message",-406056002),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"message","message",-406056002).cljs$core$IFn$_invoke$arity$1(item);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()], null);
var G__1979__$1 = (cljs.core.truth_(new cljs.core.Keyword(null,"rowId","rowId",632540453).cljs$core$IFn$_invoke$arity$1(item))?cljs.core.assoc.call(null,G__1979,new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"rowId","rowId",632540453).cljs$core$IFn$_invoke$arity$1(item)):G__1979);
var G__1979__$2 = (cljs.core.truth_(new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(item))?cljs.core.assoc.call(null,G__1979__$1,new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(item)):G__1979__$1);
var G__1979__$3 = (cljs.core.truth_(new cljs.core.Keyword(null,"field","field",-1302436500).cljs$core$IFn$_invoke$arity$1(item))?cljs.core.assoc.call(null,G__1979__$2,new cljs.core.Keyword(null,"field","field",-1302436500),cljs.core.keyword.call(null,new cljs.core.Keyword(null,"field","field",-1302436500).cljs$core$IFn$_invoke$arity$1(item))):G__1979__$2);
if(cljs.core.contains_QMARK_.call(null,item,new cljs.core.Keyword(null,"sourceValue","sourceValue",1313156611))){
return cljs.core.assoc.call(null,G__1979__$3,new cljs.core.Keyword(null,"source-value","source-value",76131443),new cljs.core.Keyword(null,"sourceValue","sourceValue",1313156611).cljs$core$IFn$_invoke$arity$1(item));
} else {
return G__1979__$3;
}
});
/**
 * Validate and normalize a public editable companion document.
 */
org.kp.kpmc.companion_rules.validate_editable_document = (function org$kp$kpmc$companion_rules$validate_editable_document(document){
var schema_version = new cljs.core.Keyword(null,"schemaVersion","schemaVersion",983417854).cljs$core$IFn$_invoke$arity$1(document);
var public_loops = ((cljs.core.vector_QMARK_.call(null,new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(document)))?new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(document):cljs.core.PersistentVector.EMPTY);
var public_elements = ((cljs.core.vector_QMARK_.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(document)))?new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(document):cljs.core.PersistentVector.EMPTY);
var loop_ids = cljs.core.map.call(null,new cljs.core.Keyword(null,"loopId","loopId",-1022364733),public_loops);
var row_ids = cljs.core.concat.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"rowId","rowId",632540453),public_elements),cljs.core.mapcat.call(null,(function (p1__1980_SHARP_){
return cljs.core.map.call(null,new cljs.core.Keyword(null,"rowId","rowId",632540453),new cljs.core.Keyword(null,"options","options",99638489).cljs$core$IFn$_invoke$arity$1(p1__1980_SHARP_));
}),public_elements));
var duplicate_loop_ids = cljs.core.set.call(null,cljs.core.keep.call(null,(function (p__1982){
var vec__1983 = p__1982;
var id = cljs.core.nth.call(null,vec__1983,(0),null);
var n = cljs.core.nth.call(null,vec__1983,(1),null);
if((n > (1))){
return id;
} else {
return null;
}
}),cljs.core.frequencies.call(null,loop_ids)));
var duplicate_row_ids = cljs.core.set.call(null,cljs.core.keep.call(null,(function (p__1986){
var vec__1987 = p__1986;
var id = cljs.core.nth.call(null,vec__1987,(0),null);
var n = cljs.core.nth.call(null,vec__1987,(1),null);
if((n > (1))){
return id;
} else {
return null;
}
}),cljs.core.frequencies.call(null,row_ids)));
var base_diagnostics = (function (){var G__1990 = cljs.core.PersistentVector.EMPTY;
if(cljs.core.not_EQ_.call(null,org.kp.kpmc.companion_rules.editable_companion_guide_schema_version,schema_version)){
return cljs.core.conj.call(null,G__1990,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"unsupported-schema-version","unsupported-schema-version",717968248),"Editable companion guide schema version is not supported.",null,new cljs.core.Keyword(null,"schema-version","schema-version",1117939594),schema_version));
} else {
return G__1990;
}
})();
var loops = cljs.core.mapv.call(null,(function (loop_def){
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),new cljs.core.Keyword(null,"loopId","loopId",-1022364733).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loopName","loopName",874146968).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segmentId","segmentId",207383330).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segmentDescription","segmentDescription",1540971248).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),(function (){var G__1991 = new cljs.core.Keyword(null,"segmentRequirement","segmentRequirement",447073040).cljs$core$IFn$_invoke$arity$1(loop_def);
if((G__1991 == null)){
return null;
} else {
return cljs.core.keyword.call(null,G__1991);
}
})()], null);
}),public_loops);
var loop_index = cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,cljs.core.juxt.call(null,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),cljs.core.identity),loops));
var element_results = cljs.core.mapv.call(null,(function (element){
var row = new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"rowId","rowId",632540453).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(element)], null);
var usage = cljs.core.keyword.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(element);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "unknown";
}
})());
var segment_ref = new cljs.core.Keyword(null,"segmentRef","segmentRef",-77913524).cljs$core$IFn$_invoke$arity$1(element);
var loop_id = new cljs.core.Keyword(null,"loopId","loopId",-1022364733).cljs$core$IFn$_invoke$arity$1(element);
var options = cljs.core.mapv.call(null,(function (option){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"rowId","rowId",632540453).cljs$core$IFn$_invoke$arity$1(option),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(option),new cljs.core.Keyword(null,"usage","usage",-1583752910),cljs.core.keyword.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(option);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "unknown";
}
})()),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"kpElement","kpElement",-48302856).cljs$core$IFn$_invoke$arity$1(option);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),new cljs.core.Keyword(null,"element-description","element-description",1941111197),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"elementDescription","elementDescription",-418664671).cljs$core$IFn$_invoke$arity$1(option);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()], null);
}),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"options","options",99638489).cljs$core$IFn$_invoke$arity$1(element);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentVector.EMPTY;
}
})());
var option_diagnostics = cljs.core.mapcat.call(null,(function (option){
var option_row = new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(option),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(option)], null);
var G__1992 = cljs.core.PersistentVector.EMPTY;
var G__1992__$1 = (((!(cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"situational","situational",-374859609),null,new cljs.core.Keyword(null,"not-used","not-used",-330157808),null,new cljs.core.Keyword(null,"required","required",1807647006),null], null), null),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(option)))))?cljs.core.conj.call(null,G__1992,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"unknown-usage","unknown-usage",-641037366),"Usage value is not supported.",option_row,new cljs.core.Keyword(null,"usage","usage",-1583752910),cljs.core.name.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(option)))):G__1992);
if(((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(option))) || (cljs.core.contains_QMARK_.call(null,duplicate_row_ids,new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(option))))){
return cljs.core.conj.call(null,G__1992__$1,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"duplicate-row-id","duplicate-row-id",770190033),"Row ID is missing or duplicated.",option_row,new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(option)));
} else {
return G__1992__$1;
}
}),options);
var element_diagnostics = (function (){var G__1993 = cljs.core.PersistentVector.EMPTY;
var G__1993__$1 = (((!(cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"situational","situational",-374859609),null,new cljs.core.Keyword(null,"not-used","not-used",-330157808),null,new cljs.core.Keyword(null,"required","required",1807647006),null], null), null),usage))))?cljs.core.conj.call(null,G__1993,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"unknown-usage","unknown-usage",-641037366),"Usage value is not supported.",row,new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(element))):G__1993);
var G__1993__$2 = (((org.kp.kpmc.companion.parse_segment_ref.call(null,segment_ref) == null))?cljs.core.conj.call(null,G__1993__$1,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"invalid-segment-ref","invalid-segment-ref",-1512204437),"Segment reference could not be parsed.",row,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),segment_ref)):G__1993__$1);
var G__1993__$3 = (((!(cljs.core.contains_QMARK_.call(null,loop_index,loop_id))))?cljs.core.conj.call(null,G__1993__$2,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"missing-loop-reference","missing-loop-reference",-1932810626),"Element refers to a loop that does not exist.",row,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),loop_id)):G__1993__$2);
if(((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(row))) || (cljs.core.contains_QMARK_.call(null,duplicate_row_ids,new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(row))))){
return cljs.core.conj.call(null,G__1993__$3,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"duplicate-row-id","duplicate-row-id",770190033),"Row ID is missing or duplicated.",row,new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"row-id","row-id",246619473).cljs$core$IFn$_invoke$arity$1(row)));
} else {
return G__1993__$3;
}
})();
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"element","element",1974019749),cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"label","label",1718410804),new cljs.core.Keyword(null,"options","options",99638489),new cljs.core.Keyword(null,"element-description","element-description",1941111197)],[(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"kpElement","kpElement",-48302856).cljs$core$IFn$_invoke$arity$1(element);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),loop_id,segment_ref,cljs.core.get.call(null,loop_index,loop_id),new cljs.core.Keyword(null,"rowId","rowId",632540453).cljs$core$IFn$_invoke$arity$1(element),usage,new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(element),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"segmentName","segmentName",-1487668030).cljs$core$IFn$_invoke$arity$1(element);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),options,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"elementDescription","elementDescription",-418664671).cljs$core$IFn$_invoke$arity$1(element);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()]),new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),cljs.core.vec.call(null,cljs.core.concat.call(null,element_diagnostics,option_diagnostics))], null);
}),public_elements);
var loop_diagnostics = cljs.core.mapcat.call(null,(function (loop_def){
var row = new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"source-row","source-row",1358263732).cljs$core$IFn$_invoke$arity$1(loop_def)], null);
var G__1994 = cljs.core.PersistentVector.EMPTY;
var G__1994__$1 = ((((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(loop_def))) || (cljs.core.contains_QMARK_.call(null,duplicate_loop_ids,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(loop_def)))))?cljs.core.conj.call(null,G__1994,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"duplicate-row-id","duplicate-row-id",770190033),"Loop ID is missing or duplicated.",row,new cljs.core.Keyword(null,"loop-id","loop-id",-338270264),new cljs.core.Keyword(null,"loop-id","loop-id",-338270264).cljs$core$IFn$_invoke$arity$1(loop_def))):G__1994);
if((!(cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 3, [null,null,new cljs.core.Keyword(null,"situational","situational",-374859609),null,new cljs.core.Keyword(null,"required","required",1807647006),null], null), null),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(loop_def))))){
return cljs.core.conj.call(null,G__1994__$1,org.kp.kpmc.companion_rules.diagnostic.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"invalid-segment-requirement","invalid-segment-requirement",-534219658),"Segment requirement is not supported.",row,new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(loop_def)));
} else {
return G__1994__$1;
}
}),loops);
var diagnostics = cljs.core.vec.call(null,cljs.core.concat.call(null,base_diagnostics,loop_diagnostics,cljs.core.mapcat.call(null,new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),element_results)));
var valid_QMARK_ = cljs.core.not_any_QMARK_.call(null,(function (p1__1981_SHARP_){
return cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"severity","severity",175684886).cljs$core$IFn$_invoke$arity$1(p1__1981_SHARP_));
}),diagnostics);
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"valid?","valid?",-212412379),valid_QMARK_,new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),diagnostics,new cljs.core.Keyword(null,"model","model",331153215),new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"schema-version","schema-version",1117939594),org.kp.kpmc.companion_rules.editable_companion_guide_schema_version,new cljs.core.Keyword(null,"source","source",-433931539),new cljs.core.Keyword(null,"source","source",-433931539).cljs$core$IFn$_invoke$arity$1(document),new cljs.core.Keyword(null,"legend","legend",-1027192245),cljs.core.mapv.call(null,(function (entry){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"row-id","row-id",246619473),new cljs.core.Keyword(null,"rowId","rowId",632540453).cljs$core$IFn$_invoke$arity$1(entry),new cljs.core.Keyword(null,"source-row","source-row",1358263732),new cljs.core.Keyword(null,"sourceRow","sourceRow",-1530800743).cljs$core$IFn$_invoke$arity$1(entry),new cljs.core.Keyword(null,"key","key",-1516042587),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"key","key",-1516042587).cljs$core$IFn$_invoke$arity$1(entry);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),new cljs.core.Keyword(null,"value","value",305978217),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"value","value",305978217).cljs$core$IFn$_invoke$arity$1(entry);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()], null);
}),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"legend","legend",-1027192245).cljs$core$IFn$_invoke$arity$1(document);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentVector.EMPTY;
}
})()),new cljs.core.Keyword(null,"loops","loops",-1766681555),loops,new cljs.core.Keyword(null,"elements","elements",657646735),cljs.core.mapv.call(null,new cljs.core.Keyword(null,"element","element",1974019749),element_results),new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),cljs.core.mapv.call(null,org.kp.kpmc.companion_rules.public_diagnostic__GT_internal,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524).cljs$core$IFn$_invoke$arity$1(document);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentVector.EMPTY;
}
})())], null)], null);
});
org.kp.kpmc.companion_rules.parse_length_limit = (function org$kp$kpmc$companion_rules$parse_length_limit(desc){
var temp__5825__auto__ = cljs.core.re_find.call(null,/up to\s+(\d+)\s+bytes/i,(function (){var or__5142__auto__ = desc;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
if(cljs.core.truth_(temp__5825__auto__)){
var m = temp__5825__auto__;
return parseInt(cljs.core.second.call(null,m),(10));
} else {
return null;
}
});
org.kp.kpmc.companion_rules.split_options = (function org$kp$kpmc$companion_rules$split_options(s){
var norm = clojure.string.replace.call(null,clojure.string.replace.call(null,(function (){var or__5142__auto__ = s;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),/\s+or\s+/,","),/\bor\b/,",");
return cljs.core.vec.call(null,cljs.core.remove.call(null,org.kp.kpmc.companion_rules.blankish_QMARK_,cljs.core.map.call(null,clojure.string.trim,clojure.string.split.call(null,norm,/,/))));
});
org.kp.kpmc.companion_rules.placeholder_kind = (function org$kp$kpmc$companion_rules$placeholder_kind(kp){
if(cljs.core._EQ_.call(null,kp,"<Blank>")){
return new cljs.core.Keyword(null,"blank","blank",-1249652109);
} else {
if(cljs.core._EQ_.call(null,kp,"<YYMMDD>")){
return new cljs.core.Keyword(null,"yymmdd","yymmdd",-870206005);
} else {
if(cljs.core._EQ_.call(null,kp,"<CCYYMMDD>")){
return new cljs.core.Keyword(null,"ccyymmdd","ccyymmdd",1143135339);
} else {
if(cljs.core._EQ_.call(null,kp,"<HHMM>")){
return new cljs.core.Keyword(null,"hhmm","hhmm",574522753);
} else {
if(cljs.core._EQ_.call(null,kp,"<HHMMSS>")){
return new cljs.core.Keyword(null,"hhmmss","hhmmss",1315391223);
} else {
if(cljs.core._EQ_.call(null,kp,"<HHMMSSDD>")){
return new cljs.core.Keyword(null,"hhmmssdd","hhmmssdd",46476879);
} else {
if(cljs.core._EQ_.call(null,kp,"<Number>")){
return new cljs.core.Keyword(null,"number","number",1570378438);
} else {
if(cljs.core._EQ_.call(null,kp,"<Unique Number>")){
return new cljs.core.Keyword(null,"unique-number","unique-number",-655810364);
} else {
if(cljs.core._EQ_.call(null,kp,"<Area Code><Phone>")){
return new cljs.core.Keyword(null,"phone10","phone10",1993045959);
} else {
if(cljs.core._EQ_.call(null,kp,"<Subscriber SSN>")){
return new cljs.core.Keyword(null,"ssn","ssn",1659668683);
} else {
if(cljs.core._EQ_.call(null,kp,"Subscriber SSN")){
return new cljs.core.Keyword(null,"ssn","ssn",1659668683);
} else {
if(cljs.core._EQ_.call(null,kp,"XXXXXXXXXXXXXXX")){
return new cljs.core.Keyword(null,"x-mask","x-mask",597326196);
} else {
if(cljs.core._EQ_.call(null,kp,"<All Possible Codes>")){
return new cljs.core.Keyword(null,"all-possible-codes","all-possible-codes",-884107306);
} else {
if(cljs.core._EQ_.call(null,kp,"All values")){
return new cljs.core.Keyword(null,"all-values","all-values",727631771);
} else {
return null;

}
}
}
}
}
}
}
}
}
}
}
}
}
}
});
/**
 * Special companion guide case: 'All Values,336(Hire Date)' means value must be 336.
 */
org.kp.kpmc.companion_rules.all_values_336_rule_QMARK_ = (function org$kp$kpmc$companion_rules$all_values_336_rule_QMARK_(kp){
return cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\s*All\s+Values\s*,\s*336(?:\s*\(.*\))?\s*/i,(function (){var or__5142__auto__ = kp;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()));
});
/**
 * For enum rules, required fields must match allowed values; optional fields may be blank.
 */
org.kp.kpmc.companion_rules.enum_valid_QMARK_ = (function org$kp$kpmc$companion_rules$enum_valid_QMARK_(usage,allowed_values,value){
var v = clojure.string.trim.call(null,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
var allowed_QMARK_ = cljs.core.contains_QMARK_.call(null,allowed_values,v);
if(cljs.core._EQ_.call(null,usage,new cljs.core.Keyword(null,"required","required",1807647006))){
return allowed_QMARK_;
} else {
return ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,v)) || (allowed_QMARK_));
}
});
/**
 * Detect the HD01 companion rule that is conditioned by BGN08 values.
 */
org.kp.kpmc.companion_rules.hd01_rule_QMARK_ = (function org$kp$kpmc$companion_rules$hd01_rule_QMARK_(rule){
return ((cljs.core._EQ_.call(null,"HD01",new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(rule))) && (cljs.core._EQ_.call(null,"001, 021, 024, 030",clojure.string.trim.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(rule);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))));
});
/**
 * Allowed HD01 values based on captured BGN08 action code.
 * BGN08=2 => 001/021/024, BGN08=4 or RX => 030.
 * If BGN08 is unavailable, keep permissive base set.
 */
org.kp.kpmc.companion_rules.hd01_allowed_by_bgn08 = (function org$kp$kpmc$companion_rules$hd01_allowed_by_bgn08(context){
var bgn08 = clojure.string.trim.call(null,(function (){var or__5142__auto__ = cljs.core.get.call(null,context,"BGN08");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
if(cljs.core._EQ_.call(null,bgn08,"2")){
return new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 3, ["021",null,"024",null,"001",null], null), null);
} else {
if(((cljs.core._EQ_.call(null,bgn08,"4")) || (cljs.core._EQ_.call(null,bgn08,"RX")))){
return new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, ["030",null], null), null);
} else {
return new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 4, ["021",null,"024",null,"030",null,"001",null], null), null);

}
}
});
/**
 * True for angle-bracket tokens that represent external references, e.g. <Fed Tax Id>.
 */
org.kp.kpmc.companion_rules.external_ref_token_QMARK_ = (function org$kp$kpmc$companion_rules$external_ref_token_QMARK_(kp){
return cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/^<[^>]+>$/,(function (){var or__5142__auto__ = kp;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()));
});
/**
 * True when a KP element expression contains any angle-bracket token text.
 */
org.kp.kpmc.companion_rules.contains_angle_token_QMARK_ = (function org$kp$kpmc$companion_rules$contains_angle_token_QMARK_(kp){
return cljs.core.boolean$.call(null,cljs.core.re_find.call(null,/[<>]/,(function (){var or__5142__auto__ = kp;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()));
});
org.kp.kpmc.companion_rules.build_rule_predicate = (function org$kp$kpmc$companion_rules$build_rule_predicate(rule){
var kp = new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(rule);
var desc = new cljs.core.Keyword(null,"element-description","element-description",1941111197).cljs$core$IFn$_invoke$arity$1(rule);
var p_kind = org.kp.kpmc.companion_rules.placeholder_kind.call(null,kp);
var ref_match = cljs.core.re_find.call(null,/^<Same as\s+([A-Z0-9]{2,3}[0-9]{2})>$/,kp);
var option_values = cljs.core.vec.call(null,cljs.core.distinct.call(null,cljs.core.remove.call(null,org.kp.kpmc.companion_rules.external_ref_token_QMARK_,cljs.core.remove.call(null,(function (p1__1995_SHARP_){
return cljs.core._EQ_.call(null,p1__1995_SHARP_,"<Blank>");
}),cljs.core.remove.call(null,org.kp.kpmc.companion_rules.blankish_QMARK_,cljs.core.mapcat.call(null,org.kp.kpmc.companion_rules.split_options,cljs.core.map.call(null,clojure.string.trim,cljs.core.concat.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [kp], null),cljs.core.map.call(null,new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),new cljs.core.Keyword(null,"options","options",99638489).cljs$core$IFn$_invoke$arity$1(rule))))))))));
var x_max_len = org.kp.kpmc.companion_rules.parse_length_limit.call(null,desc);
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"not-used","not-used",-330157808),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(rule))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"not-used","not-used",-330157808),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__1996){
var map__1997 = p__1996;
var map__1997__$1 = cljs.core.__destructure_map.call(null,map__1997);
var value = cljs.core.get.call(null,map__1997__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value),new cljs.core.Keyword(null,"expected","expected",1583670997),new cljs.core.Keyword(null,"blank","blank",-1249652109)], null);
})], null);
} else {
if(cljs.core.truth_(ref_match)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"cross-ref","cross-ref",-968358296),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__1998){
var map__1999 = p__1998;
var map__1999__$1 = cljs.core.__destructure_map.call(null,map__1999);
var value = cljs.core.get.call(null,map__1999__$1,new cljs.core.Keyword(null,"value","value",305978217));
var context = cljs.core.get.call(null,map__1999__$1,new cljs.core.Keyword(null,"context","context",-830191113));
var ref = cljs.core.second.call(null,ref_match);
var expected = cljs.core.get.call(null,context,ref);
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,expected)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"note","note",1426297904),new cljs.core.Keyword(null,"missing-reference-context","missing-reference-context",209526069)], null);
} else {
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core._EQ_.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(value)),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(expected))),new cljs.core.Keyword(null,"expected","expected",1583670997),expected,new cljs.core.Keyword(null,"actual","actual",107306363),value], null);
}
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"blank","blank",-1249652109))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2000){
var map__2001 = p__2000;
var map__2001__$1 = cljs.core.__destructure_map.call(null,map__2001);
var value = cljs.core.get.call(null,map__2001__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value)], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"yymmdd","yymmdd",-870206005))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2002){
var map__2003 = p__2002;
var map__2003__$1 = cljs.core.__destructure_map.call(null,map__2003);
var value = cljs.core.get.call(null,map__2003__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{6}/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"ccyymmdd","ccyymmdd",1143135339))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2004){
var map__2005 = p__2004;
var map__2005__$1 = cljs.core.__destructure_map.call(null,map__2005);
var value = cljs.core.get.call(null,map__2005__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{8}/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"hhmm","hhmm",574522753))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2006){
var map__2007 = p__2006;
var map__2007__$1 = cljs.core.__destructure_map.call(null,map__2007);
var value = cljs.core.get.call(null,map__2007__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{4}/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"hhmmss","hhmmss",1315391223))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2008){
var map__2009 = p__2008;
var map__2009__$1 = cljs.core.__destructure_map.call(null,map__2009);
var value = cljs.core.get.call(null,map__2009__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{6}/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"hhmmssdd","hhmmssdd",46476879))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2010){
var map__2011 = p__2010;
var map__2011__$1 = cljs.core.__destructure_map.call(null,map__2011);
var value = cljs.core.get.call(null,map__2011__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{6,8}/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(((cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"number","number",1570378438))) || (cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"unique-number","unique-number",-655810364))))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2012){
var map__2013 = p__2012;
var map__2013__$1 = cljs.core.__destructure_map.call(null,map__2013);
var value = cljs.core.get.call(null,map__2013__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d+/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"phone10","phone10",1993045959))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2014){
var map__2015 = p__2014;
var map__2015__$1 = cljs.core.__destructure_map.call(null,map__2015);
var value = cljs.core.get.call(null,map__2015__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{10}/,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"ssn","ssn",1659668683))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2016){
var map__2017 = p__2016;
var map__2017__$1 = cljs.core.__destructure_map.call(null,map__2017);
var value = cljs.core.get.call(null,map__2017__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value)) || (cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{9}/,(function (){var or__5142__auto____$1 = value;
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "";
}
})()))))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"x-mask","x-mask",597326196))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"pattern-hint","pattern-hint",1360513039),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2018){
var map__2019 = p__2018;
var map__2019__$1 = cljs.core.__destructure_map.call(null,map__2019);
var value = cljs.core.get.call(null,map__2019__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),(cljs.core.truth_(x_max_len)?(cljs.core.count.call(null,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()) <= x_max_len):(!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value))))], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"all-values","all-values",727631771))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"open","open",-1763596448),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (_){
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),true], null);
})], null);
} else {
if(org.kp.kpmc.companion_rules.all_values_336_rule_QMARK_.call(null,kp)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"enum","enum",1679018432),new cljs.core.Keyword(null,"allowed","allowed",1436019743),new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, ["336",null], null), null),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2020){
var map__2021 = p__2020;
var map__2021__$1 = cljs.core.__destructure_map.call(null,map__2021);
var value = cljs.core.get.call(null,map__2021__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),org.kp.kpmc.companion_rules.enum_valid_QMARK_.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, ["336",null], null), null),value),new cljs.core.Keyword(null,"allowed","allowed",1436019743),new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, ["336"], null)], null);
})], null);
} else {
if(cljs.core._EQ_.call(null,p_kind,new cljs.core.Keyword(null,"all-possible-codes","all-possible-codes",-884107306))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"external-code-list","external-code-list",-831532177),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2022){
var map__2023 = p__2022;
var map__2023__$1 = cljs.core.__destructure_map.call(null,map__2023);
var value = cljs.core.get.call(null,map__2023__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),((cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"required","required",1807647006)))?(!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value))):true),new cljs.core.Keyword(null,"note","note",1426297904),new cljs.core.Keyword(null,"external-code-list","external-code-list",-831532177)], null);
})], null);
} else {
if(org.kp.kpmc.companion_rules.hd01_rule_QMARK_.call(null,rule)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"enum","enum",1679018432),new cljs.core.Keyword(null,"allowed","allowed",1436019743),new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 4, ["021",null,"024",null,"030",null,"001",null], null), null),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2024){
var map__2025 = p__2024;
var map__2025__$1 = cljs.core.__destructure_map.call(null,map__2025);
var value = cljs.core.get.call(null,map__2025__$1,new cljs.core.Keyword(null,"value","value",305978217));
var context = cljs.core.get.call(null,map__2025__$1,new cljs.core.Keyword(null,"context","context",-830191113));
var allowed = org.kp.kpmc.companion_rules.hd01_allowed_by_bgn08.call(null,context);
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"valid","valid",155614240),org.kp.kpmc.companion_rules.enum_valid_QMARK_.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(rule),allowed,value),new cljs.core.Keyword(null,"allowed","allowed",1436019743),cljs.core.vec.call(null,allowed),new cljs.core.Keyword(null,"based-on","based-on",1217703581),new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"BGN08","BGN08",778448405),cljs.core.get.call(null,context,"BGN08")], null)], null);
})], null);
} else {
if(((org.kp.kpmc.companion_rules.contains_angle_token_QMARK_.call(null,kp)) && (((clojure.string.includes_QMARK_.call(null,kp,"<Blank>")) && (cljs.core.seq.call(null,option_values)))))){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"enum","enum",1679018432),new cljs.core.Keyword(null,"allowed","allowed",1436019743),cljs.core.set.call(null,option_values),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2026){
var map__2027 = p__2026;
var map__2027__$1 = cljs.core.__destructure_map.call(null,map__2027);
var value = cljs.core.get.call(null,map__2027__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value)) || (cljs.core.contains_QMARK_.call(null,cljs.core.set.call(null,option_values),clojure.string.trim.call(null,(function (){var or__5142__auto____$1 = value;
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "";
}
})())))),new cljs.core.Keyword(null,"allowed","allowed",1436019743),cljs.core.vec.call(null,cljs.core.concat.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, ["<Blank>"], null),option_values))], null);
})], null);
} else {
if((((p_kind == null)) && ((((ref_match == null)) && (org.kp.kpmc.companion_rules.contains_angle_token_QMARK_.call(null,kp)))))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"placeholder","placeholder",-104873083),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2028){
var map__2029 = p__2028;
var map__2029__$1 = cljs.core.__destructure_map.call(null,map__2029);
var value = cljs.core.get.call(null,map__2029__$1,new cljs.core.Keyword(null,"value","value",305978217));
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"required","required",1807647006))){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),(!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value))),new cljs.core.Keyword(null,"expected","expected",1583670997),new cljs.core.Keyword(null,"non-blank","non-blank",-722255043)], null);
} else {
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"valid","valid",155614240),true], null);
}
})], null);
} else {
if(cljs.core.seq.call(null,option_values)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"enum","enum",1679018432),new cljs.core.Keyword(null,"allowed","allowed",1436019743),cljs.core.set.call(null,option_values),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2030){
var map__2031 = p__2030;
var map__2031__$1 = cljs.core.__destructure_map.call(null,map__2031);
var value = cljs.core.get.call(null,map__2031__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),org.kp.kpmc.companion_rules.enum_valid_QMARK_.call(null,new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(rule),cljs.core.set.call(null,option_values),value),new cljs.core.Keyword(null,"allowed","allowed",1436019743),option_values], null);
})], null);
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"kind","kind",-717265803),new cljs.core.Keyword(null,"literal","literal",1664775605),new cljs.core.Keyword(null,"validate","validate",-201300827),(function (p__2032){
var map__2033 = p__2032;
var map__2033__$1 = cljs.core.__destructure_map.call(null,map__2033);
var value = cljs.core.get.call(null,map__2033__$1,new cljs.core.Keyword(null,"value","value",305978217));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core._EQ_.call(null,clojure.string.trim.call(null,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()),kp),new cljs.core.Keyword(null,"expected","expected",1583670997),kp], null);
})], null);

}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
});
/**
 * Compile parsed companion model rows into executable rule maps with cljs predicates.
 */
org.kp.kpmc.companion_rules.compile_rules = (function org$kp$kpmc$companion_rules$compile_rules(model){
return cljs.core.vec.call(null,cljs.core.filter.call(null,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),cljs.core.map.call(null,(function (e){
var map__2034 = (function (){var or__5142__auto__ = org.kp.kpmc.companion.parse_segment_ref.call(null,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(e));
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})();
var map__2034__$1 = cljs.core.__destructure_map.call(null,map__2034);
var segment_id = cljs.core.get.call(null,map__2034__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var position = cljs.core.get.call(null,map__2034__$1,new cljs.core.Keyword(null,"position","position",-2011731912));
var pred = org.kp.kpmc.companion_rules.build_rule_predicate.call(null,e);
return cljs.core.merge.call(null,cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"rule-id","rule-id",426305841),new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"label","label",1718410804),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"position","position",-2011731912),new cljs.core.Keyword(null,"options","options",99638489),new cljs.core.Keyword(null,"element-description","element-description",1941111197)],[cljs.core.get_in.call(null,e,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"loop-name","loop-name",468086403)], null)),new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(e),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(e),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = segment_id;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "UNK";
}
})())+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = org.kp.kpmc.companion_rules.zero_pad2.call(null,(function (){var or__5142__auto__ = position;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})());
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "00";
}
})())),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(e),cljs.core.get_in.call(null,e,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229)], null)),new cljs.core.Keyword(null,"label","label",1718410804).cljs$core$IFn$_invoke$arity$1(e),cljs.core.get_in.call(null,e,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987)], null)),segment_id,position,new cljs.core.Keyword(null,"options","options",99638489).cljs$core$IFn$_invoke$arity$1(e),new cljs.core.Keyword(null,"element-description","element-description",1941111197).cljs$core$IFn$_invoke$arity$1(e)]),pred);
}),new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(model))));
});
org.kp.kpmc.companion_rules.parse_companion_csv__GT_rules = (function org$kp$kpmc$companion_rules$parse_companion_csv__GT_rules(csv_file){
cljs.core.println.call(null,"[parse-companion-csv->rules]");

var model = ((cljs.core.map_QMARK_.call(null,csv_file))?csv_file:org.kp.kpmc.companion_rules.parse_companion_csv__GT_model.call(null,org.kp.kpmc.io_node.read_text.call(null,csv_file)));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"model","model",331153215),model,new cljs.core.Keyword(null,"rules","rules",1198912366),org.kp.kpmc.companion_rules.compile_rules.call(null,model)], null);
});
org.kp.kpmc.companion_rules.to_ref = (function org$kp$kpmc$companion_rules$to_ref(segment_id,position){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(segment_id)+cljs.core.str.cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.companion_rules.zero_pad2.call(null,position)));
});
org.kp.kpmc.companion_rules.extract_seg_id = (function org$kp$kpmc$companion_rules$extract_seg_id(data_segment_node){
return cljs.core.some.call(null,(function (child){
if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,child,"seg_id")){
return cljs.core.second.call(null,child);
} else {
return null;
}
}),cljs.core.rest.call(null,data_segment_node));
});
org.kp.kpmc.companion_rules.extract_unit_values = (function org$kp$kpmc$companion_rules$extract_unit_values(data_segment_node){
return cljs.core.vec.call(null,cljs.core.map.call(null,(function (unit){
var second_val = cljs.core.second.call(null,unit);
if(cljs.core.map_QMARK_.call(null,second_val)){
return cljs.core.nth.call(null,unit,(2),null);
} else {
return second_val;
}
}),cljs.core.filter.call(null,(function (p1__2035_SHARP_){
return org.kp.kpmc.companion_rules.tag_EQ_.call(null,p1__2035_SHARP_,"data_segment_unit");
}),cljs.core.rest.call(null,data_segment_node))));
});
org.kp.kpmc.companion_rules.annotate_unit = (function org$kp$kpmc$companion_rules$annotate_unit(unit,annotation){
var second_val = cljs.core.second.call(null,unit);
if(cljs.core.map_QMARK_.call(null,second_val)){
var val = cljs.core.nth.call(null,unit,(2),null);
return new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,unit),cljs.core.merge.call(null,second_val,annotation),val], null);
} else {
return new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,unit),annotation,second_val], null);
}
});
/**
 * Split raw segment text into [segment-id values].
 */
org.kp.kpmc.companion_rules.split_raw_segment = (function org$kp$kpmc$companion_rules$split_raw_segment(raw){
var parts = clojure.string.split.call(null,(function (){var or__5142__auto__ = raw;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),/\*/,(-1));
var seg_id = cljs.core.first.call(null,parts);
var values = cljs.core.vec.call(null,cljs.core.rest.call(null,parts));
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [seg_id,values], null);
});
org.kp.kpmc.companion_rules.safe_read_json = (function org$kp$kpmc$companion_rules$safe_read_json(text){
try{return cljs.core.js__GT_clj.call(null,JSON.parse(text),new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true);
}catch (e2036){var _ = e2036;
return null;
}});
org.kp.kpmc.companion_rules.env_get = (function org$kp$kpmc$companion_rules$env_get(k){
return (process.env[k]);
});
org.kp.kpmc.companion_rules.now_ms = (function org$kp$kpmc$companion_rules$now_ms(){
return Date.now();
});
org.kp.kpmc.companion_rules.now_iso = (function org$kp$kpmc$companion_rules$now_iso(){
return (new Date()).toISOString();
});
org.kp.kpmc.companion_rules.ensure_parent_dir_for_file_BANG_ = (function org$kp$kpmc$companion_rules$ensure_parent_dir_for_file_BANG_(output_file){
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,output_file)){
return null;
} else {
var path_mod = require("path");
var fs = require("fs");
var dir = path_mod.dirname(output_file);
return fs.mkdirSync(dir,cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"recursive","recursive",718885872),true], null)));
}
});
org.kp.kpmc.companion_rules.append_ndjson_line_BANG_ = (function org$kp$kpmc$companion_rules$append_ndjson_line_BANG_(output_file,payload){
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,output_file)){
return null;
} else {
org.kp.kpmc.companion_rules.ensure_parent_dir_for_file_BANG_.call(null,output_file);

return require("fs").appendFileSync(output_file,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(JSON.stringify(cljs.core.clj__GT_js.call(null,payload)))+"\n"),"utf8");
}
});
org.kp.kpmc.companion_rules.init_progress_file_BANG_ = (function org$kp$kpmc$companion_rules$init_progress_file_BANG_(output_file){
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,output_file)){
return null;
} else {
org.kp.kpmc.companion_rules.ensure_parent_dir_for_file_BANG_.call(null,output_file);

return require("fs").writeFileSync(output_file,"","utf8");
}
});
org.kp.kpmc.companion_rules.emit_progress_BANG_ = (function org$kp$kpmc$companion_rules$emit_progress_BANG_(opts,event){
var cb = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"on-progress","on-progress",1196110410).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"onProgress","onProgress",987195821).cljs$core$IFn$_invoke$arity$1(opts);
}
})();
var output_file = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})();
if(cljs.core.truth_(cb)){
try{cb.call(null,cljs.core.clj__GT_js.call(null,event));
}catch (e2037){var e_2038 = e2037;
cljs.core.println.call(null,"[progress-callback-error]",e_2038.message);
}} else {
}

return org.kp.kpmc.companion_rules.append_ndjson_line_BANG_.call(null,output_file,event);
});
org.kp.kpmc.companion_rules.normalize_heartbeat_every = (function org$kp$kpmc$companion_rules$normalize_heartbeat_every(opts){
var raw = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"heartbeat-every-db-attempts","heartbeat-every-db-attempts",45700953).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"heartbeatEveryDbAttempts","heartbeatEveryDbAttempts",-1620453129).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return (0);
}
}
})();
var n = ((typeof raw === 'number')?raw:parseInt((""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(raw)),(10)));
if(((isNaN(n)) || ((n <= (0))))){
return (0);
} else {
return n;
}
});
/**
 * Count INS data segments in a parsed tree for progress percentage calculations.
 */
org.kp.kpmc.companion_rules.count_ins_segments = (function org$kp$kpmc$companion_rules$count_ins_segments(tree){
var count_node = (function org$kp$kpmc$companion_rules$count_ins_segments_$_count_node(node){
if((!(cljs.core.sequential_QMARK_.call(null,node)))){
return (0);
} else {
var is_ins_QMARK_ = ((org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"data_segment"))?cljs.core._EQ_.call(null,"INS",org.kp.kpmc.companion_rules.extract_seg_id.call(null,node)):((org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"raw_segment"))?cljs.core._EQ_.call(null,"INS",cljs.core.first.call(null,org.kp.kpmc.companion_rules.split_raw_segment.call(null,cljs.core.second.call(null,node)))):false
));
return (((is_ins_QMARK_)?(1):(0)) + cljs.core.reduce.call(null,cljs.core._PLUS_,(0),cljs.core.map.call(null,org$kp$kpmc$companion_rules$count_ins_segments_$_count_node,cljs.core.rest.call(null,node))));
}
});
return count_node.call(null,tree);
});
org.kp.kpmc.companion_rules.build_subscriber_key = (function org$kp$kpmc$companion_rules$build_subscriber_key(subscriber_index,subscriber_ssn,run_id){
if(cljs.core.truth_(cljs.core.re_matches.call(null,/\d{9}/,org.kp.kpmc.companion_rules.normalize_ssn.call(null,subscriber_ssn)))){
return org.kp.kpmc.companion_rules.normalize_ssn.call(null,subscriber_ssn);
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = run_id;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "run";
}
})())+"-subscriber-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = subscriber_index;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()));
}
});
org.kp.kpmc.companion_rules.default_subscriber_progress = (function org$kp$kpmc$companion_rules$default_subscriber_progress(subscriber_index,subscriber_ssn){
return cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"db-passed","db-passed",198436552),new cljs.core.Keyword(null,"failure-reasons","failure-reasons",287546828),new cljs.core.Keyword(null,"db-attempted","db-attempted",1408905196),new cljs.core.Keyword(null,"db-skipped","db-skipped",-943014801),new cljs.core.Keyword(null,"structure-failed","structure-failed",-313903498),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"structure-total","structure-total",-952958790),new cljs.core.Keyword(null,"structure-passed","structure-passed",-480953573),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"db-failed","db-failed",2141279772),new cljs.core.Keyword(null,"lookup-status-counts","lookup-status-counts",-335990626)],[org.kp.kpmc.companion_rules.now_iso.call(null),(0),cljs.core.PersistentVector.EMPTY,(0),(0),(0),subscriber_index,(0),(0),org.kp.kpmc.companion_rules.normalize_ssn.call(null,subscriber_ssn),(0),cljs.core.PersistentArrayMap.EMPTY]);
});
org.kp.kpmc.companion_rules.update_subscriber_progress = (function org$kp$kpmc$companion_rules$update_subscriber_progress(sp,rule_valid_QMARK_,lookup_result,db_context){
var lookup_applied_QMARK_ = cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766).cljs$core$IFn$_invoke$arity$1(lookup_result));
var lookup_valid_QMARK_ = cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(lookup_result));
var lookup_executed_QMARK_ = cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"executed?","executed?",802143904).cljs$core$IFn$_invoke$arity$1(lookup_result));
var lookup_status = new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(lookup_result);
var reason = new cljs.core.Keyword(null,"reason","reason",-2070751759).cljs$core$IFn$_invoke$arity$1(lookup_result);
var G__2039 = cljs.core.update_in.call(null,cljs.core.update.call(null,cljs.core.update.call(null,cljs.core.update.call(null,sp,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),(function (cur){
var or__5142__auto__ = (cljs.core.truth_(cljs.core.re_matches.call(null,/\d{9}/,org.kp.kpmc.companion_rules.normalize_ssn.call(null,cur)))?cur:null);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = org.kp.kpmc.companion_rules.normalize_ssn.call(null,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(db_context));
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return cur;
}
}
})),new cljs.core.Keyword(null,"structure-total","structure-total",-952958790),cljs.core.inc),(cljs.core.truth_(rule_valid_QMARK_)?new cljs.core.Keyword(null,"structure-passed","structure-passed",-480953573):new cljs.core.Keyword(null,"structure-failed","structure-failed",-313903498)),cljs.core.inc),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"lookup-status-counts","lookup-status-counts",-335990626),lookup_status], null),cljs.core.fnil.call(null,cljs.core.inc,(0)));
var G__2039__$1 = ((lookup_applied_QMARK_)?(function (){var G__2040 = cljs.core.update.call(null,cljs.core.update.call(null,G__2039,new cljs.core.Keyword(null,"db-attempted","db-attempted",1408905196),cljs.core.inc),((lookup_valid_QMARK_)?new cljs.core.Keyword(null,"db-passed","db-passed",198436552):new cljs.core.Keyword(null,"db-failed","db-failed",2141279772)),cljs.core.inc);
if((!(lookup_executed_QMARK_))){
return cljs.core.update.call(null,G__2040,new cljs.core.Keyword(null,"db-skipped","db-skipped",-943014801),cljs.core.inc);
} else {
return G__2040;
}
})():G__2039);
var G__2039__$2 = (((!(lookup_applied_QMARK_)))?cljs.core.update.call(null,G__2039__$1,new cljs.core.Keyword(null,"db-skipped","db-skipped",-943014801),cljs.core.inc):G__2039__$1);
var G__2039__$3 = (cljs.core.truth_((function (){var and__5140__auto__ = cljs.core.not.call(null,rule_valid_QMARK_);
if(and__5140__auto__){
return reason;
} else {
return and__5140__auto__;
}
})())?cljs.core.update.call(null,G__2039__$2,new cljs.core.Keyword(null,"failure-reasons","failure-reasons",287546828),cljs.core.conj,reason):G__2039__$2);
if(cljs.core.truth_((function (){var and__5140__auto__ = lookup_applied_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = (!(lookup_valid_QMARK_));
if(and__5140__auto____$1){
return reason;
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
return cljs.core.update.call(null,G__2039__$3,new cljs.core.Keyword(null,"failure-reasons","failure-reasons",287546828),cljs.core.conj,reason);
} else {
return G__2039__$3;
}
});
org.kp.kpmc.companion_rules.subscriber_final_status = (function org$kp$kpmc$companion_rules$subscriber_final_status(subscriber_progress,db_validation_enabled_QMARK_){
var structure_failed = new cljs.core.Keyword(null,"structure-failed","structure-failed",-313903498).cljs$core$IFn$_invoke$arity$1(subscriber_progress);
var db_failed = new cljs.core.Keyword(null,"db-failed","db-failed",2141279772).cljs$core$IFn$_invoke$arity$1(subscriber_progress);
var db_attempted = new cljs.core.Keyword(null,"db-attempted","db-attempted",1408905196).cljs$core$IFn$_invoke$arity$1(subscriber_progress);
var db_skipped = new cljs.core.Keyword(null,"db-skipped","db-skipped",-943014801).cljs$core$IFn$_invoke$arity$1(subscriber_progress);
if((((structure_failed > (0))) || ((db_failed > (0))))){
return "completed-failed";
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = db_validation_enabled_QMARK_;
if(cljs.core.truth_(and__5140__auto__)){
return (((db_attempted === (0))) || ((db_skipped > (0))));
} else {
return and__5140__auto__;
}
})())){
return "completed-partial";
} else {
return "completed-passed";

}
}
});
org.kp.kpmc.companion_rules.build_subscriber_progress_summary = (function org$kp$kpmc$companion_rules$build_subscriber_progress_summary(subscriber_statuses){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"total","total",1916810418),cljs.core.count.call(null,subscriber_statuses),new cljs.core.Keyword(null,"completed-passed","completed-passed",-2095238559),cljs.core.count.call(null,cljs.core.filter.call(null,(function (p1__2041_SHARP_){
return cljs.core._EQ_.call(null,"completed-passed",new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(p1__2041_SHARP_));
}),subscriber_statuses)),new cljs.core.Keyword(null,"completed-failed","completed-failed",1681326090),cljs.core.count.call(null,cljs.core.filter.call(null,(function (p1__2042_SHARP_){
return cljs.core._EQ_.call(null,"completed-failed",new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(p1__2042_SHARP_));
}),subscriber_statuses)),new cljs.core.Keyword(null,"completed-partial","completed-partial",1321839227),cljs.core.count.call(null,cljs.core.filter.call(null,(function (p1__2043_SHARP_){
return cljs.core._EQ_.call(null,"completed-partial",new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(p1__2043_SHARP_));
}),subscriber_statuses))], null);
});
org.kp.kpmc.companion_rules.merge_subscriber_progress_summary = (function org$kp$kpmc$companion_rules$merge_subscriber_progress_summary(summary,subscriber_statuses){
return cljs.core.merge_with.call(null,cljs.core._PLUS_,summary,org.kp.kpmc.companion_rules.build_subscriber_progress_summary.call(null,subscriber_statuses));
});
/**
 * Canonicalize SSN to digits-only for binds and in-memory state.
 */
org.kp.kpmc.companion_rules.normalize_ssn = (function org$kp$kpmc$companion_rules$normalize_ssn(s){
return clojure.string.replace.call(null,clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = s;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))),/\D/,"");
});
org.kp.kpmc.companion_rules.normalize_identification_type_code = (function org$kp$kpmc$companion_rules$normalize_identification_type_code(v){
var x = clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = v;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
if(cljs.core._EQ_.call(null,x,"34")){
return "SSN";
} else {
return x;
}
});
org.kp.kpmc.companion_rules.normalize_lookup_value = (function org$kp$kpmc$companion_rules$normalize_lookup_value(column,value){
var v = clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
if(cljs.core._EQ_.call(null,column,"SUBSCRIBER_SSN")){
return org.kp.kpmc.companion_rules.normalize_ssn.call(null,v);
} else {
if(cljs.core._EQ_.call(null,column,"IDENTIFICATION_VALUE")){
return org.kp.kpmc.companion_rules.normalize_ssn.call(null,v);
} else {
if(cljs.core._EQ_.call(null,column,"IDENTIFICATION_TYPE_CODE")){
return org.kp.kpmc.companion_rules.normalize_identification_type_code.call(null,v);
} else {
return clojure.string.upper_case.call(null,v);

}
}
}
});
/**
 * Generate candidate expected values to tolerate DB formatting for date/time columns.
 */
org.kp.kpmc.companion_rules.lookup_expected_candidates = (function org$kp$kpmc$companion_rules$lookup_expected_candidates(value){
var v = clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
var digits = clojure.string.replace.call(null,v,/\D/,"");
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,v)){
return new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, ["",null], null), null);
} else {
if(cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{8}/,v))){
var G__2044 = cljs.core.PersistentHashSet.createAsIfByAssoc([v,digits]);
if((((digits).length) >= (6))){
return cljs.core.conj.call(null,G__2044,cljs.core.subs.call(null,digits,(0),(6)));
} else {
return G__2044;
}
} else {
if(cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{6,8}/,v))){
var G__2045 = cljs.core.PersistentHashSet.createAsIfByAssoc([v,digits]);
if((((digits).length) >= (6))){
return cljs.core.conj.call(null,G__2045,cljs.core.subs.call(null,digits,(0),(6)));
} else {
return G__2045;
}
} else {
return cljs.core.PersistentHashSet.createAsIfByAssoc([v]);

}
}
}
});
org.kp.kpmc.companion_rules.lookup_value_match_QMARK_ = (function org$kp$kpmc$companion_rules$lookup_value_match_QMARK_(actual_values,expected){
var exp_candidates = org.kp.kpmc.companion_rules.lookup_expected_candidates.call(null,expected);
return cljs.core.boolean$.call(null,cljs.core.some.call(null,(function (p1__2046_SHARP_){
return cljs.core.contains_QMARK_.call(null,actual_values,p1__2046_SHARP_);
}),exp_candidates));
});
/**
 * Extract subscriber SSNs per INS block from parsed tree.
 * Prefers REF02 when REF01=0F, falls back to NM109 when NM108=34.
 */
org.kp.kpmc.companion_rules.extract_subscriber_ssns_from_parse_tree = (function org$kp$kpmc$companion_rules$extract_subscriber_ssns_from_parse_tree(parse_tree){
var state_STAR_ = cljs.core.atom.call(null,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"in-subscriber?","in-subscriber?",-894556435),false,new cljs.core.Keyword(null,"current","current",-1088038603),null,new cljs.core.Keyword(null,"out","out",-910545517),cljs.core.PersistentVector.EMPTY], null));
var finalize_BANG_ = (function (){
if(cljs.core.truth_(new cljs.core.Keyword(null,"in-subscriber?","in-subscriber?",-894556435).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,state_STAR_)))){
var ssn = org.kp.kpmc.companion_rules.normalize_ssn.call(null,new cljs.core.Keyword(null,"current","current",-1088038603).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,state_STAR_)));
return cljs.core.swap_BANG_.call(null,state_STAR_,cljs.core.update,new cljs.core.Keyword(null,"out","out",-910545517),cljs.core.conj,(cljs.core.truth_(cljs.core.re_matches.call(null,/\d{9}/,ssn))?ssn:null));
} else {
return null;
}
});
var visit_segment_BANG_ = (function (seg_id,values){
var vals = cljs.core.vec.call(null,cljs.core.map.call(null,(function (p1__2047_SHARP_){
return clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = p1__2047_SHARP_;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
}),values));
if(cljs.core._EQ_.call(null,seg_id,"INS")){
finalize_BANG_.call(null);

return cljs.core.swap_BANG_.call(null,state_STAR_,cljs.core.assoc,new cljs.core.Keyword(null,"in-subscriber?","in-subscriber?",-894556435),true,new cljs.core.Keyword(null,"current","current",-1088038603),null);
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core._EQ_.call(null,seg_id,"REF");
if(and__5140__auto__){
var and__5140__auto____$1 = cljs.core._EQ_.call(null,"0F",cljs.core.nth.call(null,vals,(0),""));
if(and__5140__auto____$1){
return cljs.core.re_matches.call(null,/\d{9}/,org.kp.kpmc.companion_rules.normalize_ssn.call(null,cljs.core.nth.call(null,vals,(1),"")));
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
return cljs.core.swap_BANG_.call(null,state_STAR_,cljs.core.assoc,new cljs.core.Keyword(null,"current","current",-1088038603),org.kp.kpmc.companion_rules.normalize_ssn.call(null,cljs.core.nth.call(null,vals,(1),"")));
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core._EQ_.call(null,seg_id,"NM1");
if(and__5140__auto__){
var and__5140__auto____$1 = cljs.core._EQ_.call(null,"34",cljs.core.nth.call(null,vals,(7),""));
if(and__5140__auto____$1){
var and__5140__auto____$2 = cljs.core.re_matches.call(null,/\d{9}/,org.kp.kpmc.companion_rules.normalize_ssn.call(null,cljs.core.nth.call(null,vals,(8),"")));
if(cljs.core.truth_(and__5140__auto____$2)){
return org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,new cljs.core.Keyword(null,"current","current",-1088038603).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,state_STAR_)));
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
return cljs.core.swap_BANG_.call(null,state_STAR_,cljs.core.assoc,new cljs.core.Keyword(null,"current","current",-1088038603),org.kp.kpmc.companion_rules.normalize_ssn.call(null,cljs.core.nth.call(null,vals,(8),"")));
} else {
return null;

}
}
}
});
var walk = (function org$kp$kpmc$companion_rules$extract_subscriber_ssns_from_parse_tree_$_walk(node){
if(cljs.core.sequential_QMARK_.call(null,node)){
if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"data_segment")){
var seg_id_2055 = org.kp.kpmc.companion_rules.extract_seg_id.call(null,node);
var values_2056 = org.kp.kpmc.companion_rules.extract_unit_values.call(null,node);
visit_segment_BANG_.call(null,seg_id_2055,values_2056);
} else {
if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"raw_segment")){
var vec__2048_2057 = org.kp.kpmc.companion_rules.split_raw_segment.call(null,cljs.core.second.call(null,node));
var seg_id_2058 = cljs.core.nth.call(null,vec__2048_2057,(0),null);
var values_2059 = cljs.core.nth.call(null,vec__2048_2057,(1),null);
visit_segment_BANG_.call(null,seg_id_2058,values_2059);
} else {

}
}

var seq__2051 = cljs.core.seq.call(null,cljs.core.rest.call(null,node));
var chunk__2052 = null;
var count__2053 = (0);
var i__2054 = (0);
while(true){
if((i__2054 < count__2053)){
var c = cljs.core._nth.call(null,chunk__2052,i__2054);
org$kp$kpmc$companion_rules$extract_subscriber_ssns_from_parse_tree_$_walk.call(null,c);


var G__2060 = seq__2051;
var G__2061 = chunk__2052;
var G__2062 = count__2053;
var G__2063 = (i__2054 + (1));
seq__2051 = G__2060;
chunk__2052 = G__2061;
count__2053 = G__2062;
i__2054 = G__2063;
continue;
} else {
var temp__5825__auto__ = cljs.core.seq.call(null,seq__2051);
if(temp__5825__auto__){
var seq__2051__$1 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2051__$1)){
var c__5673__auto__ = cljs.core.chunk_first.call(null,seq__2051__$1);
var G__2064 = cljs.core.chunk_rest.call(null,seq__2051__$1);
var G__2065 = c__5673__auto__;
var G__2066 = cljs.core.count.call(null,c__5673__auto__);
var G__2067 = (0);
seq__2051 = G__2064;
chunk__2052 = G__2065;
count__2053 = G__2066;
i__2054 = G__2067;
continue;
} else {
var c = cljs.core.first.call(null,seq__2051__$1);
org$kp$kpmc$companion_rules$extract_subscriber_ssns_from_parse_tree_$_walk.call(null,c);


var G__2068 = cljs.core.next.call(null,seq__2051__$1);
var G__2069 = null;
var G__2070 = (0);
var G__2071 = (0);
seq__2051 = G__2068;
chunk__2052 = G__2069;
count__2053 = G__2070;
i__2054 = G__2071;
continue;
}
} else {
return null;
}
}
break;
}
} else {
return null;
}
});
walk.call(null,parse_tree);

finalize_BANG_.call(null);

return new cljs.core.Keyword(null,"out","out",-910545517).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,state_STAR_));
});
org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_ = (function org$kp$kpmc$companion_rules$safe_sql_ident_QMARK_(s){
return cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/[A-Z][A-Z0-9_]*/,(function (){var or__5142__auto__ = s;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()));
});
org.kp.kpmc.companion_rules.safe_sql_literal = (function org$kp$kpmc$companion_rules$safe_sql_literal(s){
return clojure.string.replace.call(null,(function (){var or__5142__auto__ = s;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),/'/,"''");
});
org.kp.kpmc.companion_rules.resolve_env_name = (function org$kp$kpmc$companion_rules$resolve_env_name(opts){
var or__5142__auto__ = new cljs.core.Keyword(null,"env-name","env-name",1998966009).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"envName","envName",-1555267237).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
var or__5142__auto____$2 = org.kp.kpmc.companion_rules.env_get.call(null,"envName");
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return org.kp.kpmc.companion_rules.env_get.call(null,"ENV_NAME");
}
}
}
});
org.kp.kpmc.companion_rules.db_env_keys = (function org$kp$kpmc$companion_rules$db_env_keys(env_name){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"user-key","user-key",628459277),(""+"host."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(env_name)+"-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.user"),new cljs.core.Keyword(null,"password-key","password-key",-274998740),(""+"host."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(env_name)+"-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.password"),new cljs.core.Keyword(null,"url-key","url-key",-154120626),(""+"host."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(env_name)+"-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.url")], null);
});
org.kp.kpmc.companion_rules.resolve_db_config = (function org$kp$kpmc$companion_rules$resolve_db_config(opts){
var env_name = org.kp.kpmc.companion_rules.resolve_env_name.call(null,opts);
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,env_name)){
return null;
} else {
var map__2072 = org.kp.kpmc.companion_rules.db_env_keys.call(null,env_name);
var map__2072__$1 = cljs.core.__destructure_map.call(null,map__2072);
var user_key = cljs.core.get.call(null,map__2072__$1,new cljs.core.Keyword(null,"user-key","user-key",628459277));
var password_key = cljs.core.get.call(null,map__2072__$1,new cljs.core.Keyword(null,"password-key","password-key",-274998740));
var url_key = cljs.core.get.call(null,map__2072__$1,new cljs.core.Keyword(null,"url-key","url-key",-154120626));
var user = org.kp.kpmc.companion_rules.env_get.call(null,user_key);
var password = org.kp.kpmc.companion_rules.env_get.call(null,password_key);
var connect_string = org.kp.kpmc.companion_rules.env_get.call(null,url_key);
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"env-name","env-name",1998966009),env_name,new cljs.core.Keyword(null,"user-key","user-key",628459277),user_key,new cljs.core.Keyword(null,"password-key","password-key",-274998740),password_key,new cljs.core.Keyword(null,"url-key","url-key",-154120626),url_key,new cljs.core.Keyword(null,"user","user",1532431356),user,new cljs.core.Keyword(null,"password","password",417022471),password,new cljs.core.Keyword(null,"connect-string","connect-string",1883795257),connect_string,new cljs.core.Keyword(null,"valid?","valid?",-212412379),(((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,user)))) && ((((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,password)))) && ((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,connect_string)))))))], null);
}
});
/**
 * Default to subscriber-only DB validation unless explicitly disabled.
 * Accepts opts flag or env var SUBSCRIBER_ONLY_DB_VALIDATION=false.
 */
org.kp.kpmc.companion_rules.resolve_subscriber_only_db_validation_QMARK_ = (function org$kp$kpmc$companion_rules$resolve_subscriber_only_db_validation_QMARK_(opts){
var raw = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-only-db-validation?","subscriber-only-db-validation?",511213543).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"subscriberOnlyDbValidation","subscriberOnlyDbValidation",608166416).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
var or__5142__auto____$2 = org.kp.kpmc.companion_rules.env_get.call(null,"SUBSCRIBER_ONLY_DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return true;
}
}
}
})();
var v = ((typeof raw === 'string')?clojure.string.lower_case.call(null,clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(raw)))):raw);
if(cljs.core.boolean_QMARK_.call(null,v)){
return v;
} else {
if(typeof v === 'string'){
return (!(cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 4, ["n",null,"false",null,"0",null,"no",null], null), null),v)));
} else {
return true;

}
}
});
org.kp.kpmc.companion_rules.loop_name__GT_scope = (function org$kp$kpmc$companion_rules$loop_name__GT_scope(loop_name){
var v = clojure.string.trim.call(null,(function (){var or__5142__auto__ = loop_name;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
if(((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,v)) || (((cljs.core._EQ_.call(null,v,"Header")) || (clojure.string.starts_with_QMARK_.call(null,v,"1000")))))){
return new cljs.core.Keyword(null,"commercial","commercial",-988961312);
} else {
if(cljs.core.truth_(cljs.core.re_matches.call(null,/^[2-9].*/,v))){
return new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413);
} else {
return new cljs.core.Keyword(null,"commercial","commercial",-988961312);

}
}
});
org.kp.kpmc.companion_rules.ensure_current_subscriber = (function org$kp$kpmc$companion_rules$ensure_current_subscriber(db_state_STAR_){
var cur = new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,db_state_STAR_));
if((cur == null)){
return cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc,new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"index","index",-1531685915),((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,db_state_STAR_));
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (1)),new cljs.core.Keyword(null,"ssn","ssn",1659668683),null,new cljs.core.Keyword(null,"refs","refs",-1560051448),cljs.core.PersistentArrayMap.EMPTY], null));
} else {
return null;
}
});
org.kp.kpmc.companion_rules.start_new_subscriber_BANG_ = (function org$kp$kpmc$companion_rules$start_new_subscriber_BANG_(db_state_STAR_){
var map__2073 = cljs.core.deref.call(null,db_state_STAR_);
var map__2073__$1 = cljs.core.__destructure_map.call(null,map__2073);
var current_subscriber = cljs.core.get.call(null,map__2073__$1,new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038));
var subscribers = cljs.core.get.call(null,map__2073__$1,new cljs.core.Keyword(null,"subscribers","subscribers",-606401562));
var subscriber_ssns = cljs.core.get.call(null,map__2073__$1,new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804));
var subscriber_index_offset = cljs.core.get.call(null,map__2073__$1,new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528));
var persisted = (cljs.core.truth_((function (){var and__5140__auto__ = current_subscriber;
if(cljs.core.truth_(and__5140__auto__)){
return (((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,new cljs.core.Keyword(null,"ssn","ssn",1659668683).cljs$core$IFn$_invoke$arity$1(current_subscriber))))) || (cljs.core.seq.call(null,new cljs.core.Keyword(null,"refs","refs",-1560051448).cljs$core$IFn$_invoke$arity$1(current_subscriber))));
} else {
return and__5140__auto__;
}
})())?cljs.core.conj.call(null,subscribers,current_subscriber):subscribers);
var local_index = (cljs.core.count.call(null,persisted) + (1));
var next_index = ((function (){var or__5142__auto__ = subscriber_index_offset;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + local_index);
var subscriber_ssn = cljs.core.nth.call(null,subscriber_ssns,(local_index - (1)),null);
return cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc,new cljs.core.Keyword(null,"subscribers","subscribers",-606401562),persisted,new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"index","index",-1531685915),next_index,new cljs.core.Keyword(null,"ssn","ssn",1659668683),subscriber_ssn,new cljs.core.Keyword(null,"refs","refs",-1560051448),cljs.core.PersistentArrayMap.EMPTY], null));
});
org.kp.kpmc.companion_rules.maybe_capture_subscriber_ssn_BANG_ = (function org$kp$kpmc$companion_rules$maybe_capture_subscriber_ssn_BANG_(db_state_STAR_,context,seg_id,position,value){
var v = clojure.string.trim.call(null,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
var ssn = org.kp.kpmc.companion_rules.normalize_ssn.call(null,v);
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core._EQ_.call(null,seg_id,"REF");
if(and__5140__auto__){
var and__5140__auto____$1 = cljs.core._EQ_.call(null,position,(2));
if(and__5140__auto____$1){
var and__5140__auto____$2 = cljs.core._EQ_.call(null,clojure.string.trim.call(null,(function (){var or__5142__auto__ = cljs.core.get.call(null,context,"REF01");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()),"0F");
if(and__5140__auto____$2){
return cljs.core.re_matches.call(null,/\d{9}/,ssn);
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
org.kp.kpmc.companion_rules.ensure_current_subscriber.call(null,db_state_STAR_);

return cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc_in,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"ssn","ssn",1659668683)], null),ssn);
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core._EQ_.call(null,seg_id,"NM1");
if(and__5140__auto__){
var and__5140__auto____$1 = cljs.core._EQ_.call(null,position,(9));
if(and__5140__auto____$1){
var and__5140__auto____$2 = cljs.core._EQ_.call(null,clojure.string.trim.call(null,(function (){var or__5142__auto__ = cljs.core.get.call(null,context,"NM108");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()),"34");
if(and__5140__auto____$2){
var and__5140__auto____$3 = cljs.core.re_matches.call(null,/\d{9}/,ssn);
if(cljs.core.truth_(and__5140__auto____$3)){
return org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,cljs.core.get_in.call(null,cljs.core.deref.call(null,db_state_STAR_),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"ssn","ssn",1659668683)], null)));
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
org.kp.kpmc.companion_rules.ensure_current_subscriber.call(null,db_state_STAR_);

return cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc_in,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"ssn","ssn",1659668683)], null),ssn);
} else {
return null;

}
}
});
org.kp.kpmc.companion_rules.update_db_state_BANG_ = (function org$kp$kpmc$companion_rules$update_db_state_BANG_(db_state_STAR_,context,rule,seg_id,position,value){
var ref = org.kp.kpmc.companion_rules.to_ref.call(null,seg_id,position);
var scope = org.kp.kpmc.companion_rules.loop_name__GT_scope.call(null,new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(rule));
var v = clojure.string.trim.call(null,(function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
if(((cljs.core._EQ_.call(null,seg_id,"INS")) && (cljs.core._EQ_.call(null,position,(1))))){
org.kp.kpmc.companion_rules.start_new_subscriber_BANG_.call(null,db_state_STAR_);
} else {
}

if(cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413))){
org.kp.kpmc.companion_rules.ensure_current_subscriber.call(null,db_state_STAR_);
} else {
}

if((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,v)))){
if(cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"commercial","commercial",-988961312))){
cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc_in,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454),ref], null),value);
} else {
cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc_in,new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"refs","refs",-1560051448),ref], null),value);
}
} else {
}

return org.kp.kpmc.companion_rules.maybe_capture_subscriber_ssn_BANG_.call(null,db_state_STAR_,context,seg_id,position,value);
});
org.kp.kpmc.companion_rules.current_db_context = (function org$kp$kpmc$companion_rules$current_db_context(db_state_STAR_,rule){
var scope = org.kp.kpmc.companion_rules.loop_name__GT_scope.call(null,new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(rule));
var state = cljs.core.deref.call(null,db_state_STAR_);
if(cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"commercial","commercial",-988961312))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"scope","scope",-439358418),new cljs.core.Keyword(null,"commercial","commercial",-988961312),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),null,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),null,new cljs.core.Keyword(null,"refs","refs",-1560051448),new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454).cljs$core$IFn$_invoke$arity$1(state)], null);
} else {
var cur = new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038).cljs$core$IFn$_invoke$arity$1(state);
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"scope","scope",-439358418),new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"index","index",-1531685915).cljs$core$IFn$_invoke$arity$1(cur),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"ssn","ssn",1659668683).cljs$core$IFn$_invoke$arity$1(cur),new cljs.core.Keyword(null,"refs","refs",-1560051448),new cljs.core.Keyword(null,"refs","refs",-1560051448).cljs$core$IFn$_invoke$arity$1(cur)], null);
}
});
org.kp.kpmc.companion_rules.execute_oracle_query_sync = (function org$kp$kpmc$companion_rules$execute_oracle_query_sync(var_args){
var G__2075 = arguments.length;
switch (G__2075) {
case 3:
return org.kp.kpmc.companion_rules.execute_oracle_query_sync.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
case 4:
return org.kp.kpmc.companion_rules.execute_oracle_query_sync.cljs$core$IFn$_invoke$arity$4((arguments[(0)]),(arguments[(1)]),(arguments[(2)]),(arguments[(3)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.execute_oracle_query_sync.cljs$core$IFn$_invoke$arity$3 = (function (db_config,sql,binds){
return org.kp.kpmc.companion_rules.execute_oracle_query_sync.call(null,db_config,sql,binds,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.companion_rules.execute_oracle_query_sync.cljs$core$IFn$_invoke$arity$4 = (function (db_config,sql,binds,opts){
var child_proc = require("child_process");
var fetch_all_QMARK_ = new cljs.core.Keyword(null,"fetch-all?","fetch-all?",1105533083).cljs$core$IFn$_invoke$arity$1(opts) === true;
var script = (""+"const oracledb=require('oracledb');"+"(async()=>{"+"const p=JSON.parse(process.argv[1]);"+"let conn=null;"+"try{"+"conn=await oracledb.getConnection({user:p.user,password:p.password,connectString:p.connectString});"+"const r=await conn.execute(p.sql,p.binds,{outFormat:oracledb.OUT_FORMAT_OBJECT});"+"const rows=r.rows||[];"+"const row=rows[0]||null;"+"const hit=(row&&(row.HIT_COUNT??row.hit_count))!=null?Number(row.HIT_COUNT??row.hit_count):rows.length;"+"const outRows=p.fetchAll?rows:rows.slice(0,10);"+"console.log(JSON.stringify({ok:true,hitCount:hit,rowCount:rows.length,row:row,rows:outRows}));"+"}catch(e){"+"console.log(JSON.stringify({ok:false,error:e&&e.message?e.message:String(e),code:e&&e.code?e.code:null,errorNum:e&&e.errorNum?e.errorNum:null}));"+"}finally{if(conn){try{await conn.close();}catch(_){}}}"+"})();");
var payload = JSON.stringify(cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"user","user",1532431356),new cljs.core.Keyword(null,"user","user",1532431356).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"password","password",417022471),new cljs.core.Keyword(null,"password","password",417022471).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"connectString","connectString",551823639),new cljs.core.Keyword(null,"connect-string","connect-string",1883795257).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"sql","sql",1251448786),sql,new cljs.core.Keyword(null,"binds","binds",363649660),binds,new cljs.core.Keyword(null,"fetchAll","fetchAll",-1631289609),fetch_all_QMARK_], null)));
try{var out = child_proc.execFileSync("node",cljs.core.clj__GT_js.call(null,new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, ["-e",script,payload], null)),cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"encoding","encoding",1728578272),"utf8",new cljs.core.Keyword(null,"maxBuffer","maxBuffer",-260753686),(((16) * (1024)) * (1024))], null)));
var or__5142__auto__ = org.kp.kpmc.companion_rules.safe_read_json.call(null,out);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"ok","ok",967785236),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"invalid-db-response","invalid-db-response",1536370188)], null);
}
}catch (e2076){var e = e2076;
var stdout = (function (){var G__2077 = e;
var G__2077__$1 = (((G__2077 == null))?null:G__2077.stdout);
if((G__2077__$1 == null)){
return null;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(G__2077__$1));
}
})();
var stderr = (function (){var G__2078 = e;
var G__2078__$1 = (((G__2078 == null))?null:G__2078.stderr);
if((G__2078__$1 == null)){
return null;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(G__2078__$1));
}
})();
var parsed_out = org.kp.kpmc.companion_rules.safe_read_json.call(null,stdout);
var parsed_err = org.kp.kpmc.companion_rules.safe_read_json.call(null,stderr);
var or__5142__auto__ = ((cljs.core.map_QMARK_.call(null,parsed_out))?parsed_out:null);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = ((cljs.core.map_QMARK_.call(null,parsed_err))?parsed_err:null);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"ok","ok",967785236),false,new cljs.core.Keyword(null,"error","error",-978969032),(function (){var or__5142__auto____$2 = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,stdout))?null:stdout);
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
var or__5142__auto____$3 = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,stderr))?null:stderr);
if(cljs.core.truth_(or__5142__auto____$3)){
return or__5142__auto____$3;
} else {
var or__5142__auto____$4 = e.message;
if(cljs.core.truth_(or__5142__auto____$4)){
return or__5142__auto____$4;
} else {
return new cljs.core.Keyword(null,"db-exec-failed","db-exec-failed",-1546162415);
}
}
}
})()], null);
}
}
}}));

(org.kp.kpmc.companion_rules.execute_oracle_query_sync.cljs$lang$maxFixedArity = 4);

org.kp.kpmc.companion_rules.regex_escape = (function org$kp$kpmc$companion_rules$regex_escape(s){
return clojure.string.replace.call(null,(function (){var or__5142__auto__ = s;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),/([\\.^$|?*+(){}\[\]])/,"\\$1");
});
/**
 * For date-like EDI values (YYYYMMDD), retry Oracle lookups by comparing
 * formatted DB date/timestamp text instead of implicit DATE conversion.
 */
org.kp.kpmc.companion_rules.maybe_date_safe_sql = (function org$kp$kpmc$companion_rules$maybe_date_safe_sql(sql,column,text_value){
var v = clojure.string.trim.call(null,(function (){var or__5142__auto__ = text_value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
if(((typeof sql === 'string') && ((((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,column)))) && (cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/\d{8}/,v))))))){
var escaped_column = org.kp.kpmc.companion_rules.regex_escape.call(null,column);
var alias_pattern = (new RegExp((""+"([A-Za-z_][A-Za-z0-9_]*\\.)"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(escaped_column)+"\\s*=\\s*:value"),"i"));
var bare_pattern = (new RegExp((""+"\\b"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(escaped_column)+"\\b\\s*=\\s*:value"),"i"));
var with_alias = clojure.string.replace.call(null,sql,alias_pattern,(""+"to_char($1"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+", 'YYYYMMDD') = :value"));
var rewritten = ((cljs.core._EQ_.call(null,with_alias,sql))?clojure.string.replace.call(null,sql,bare_pattern,(""+"to_char("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+", 'YYYYMMDD') = :value")):with_alias);
if(cljs.core.not_EQ_.call(null,rewritten,sql)){
return rewritten;
} else {
return null;
}
} else {
return null;
}
});
/**
 * Rewrite a count(*) lookup into a diagnostic query that returns sample raw and
 * formatted values of the date column, so its true DB format can be logged.
 * Neutralizes the failing '<column> = :value' predicate with '1 = 1' and limits
 * the result to a few rows. Returns nil when no such predicate is found.
 */
org.kp.kpmc.companion_rules.build_date_sample_sql = (function org$kp$kpmc$companion_rules$build_date_sample_sql(sql,column){
if(((typeof sql === 'string') && ((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,column)))))){
var escaped = org.kp.kpmc.companion_rules.regex_escape.call(null,column);
var alias_pattern = (new RegExp((""+"([A-Za-z_][A-Za-z0-9_]*)\\."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(escaped)+"\\s*=\\s*:value"),"i"));
var bare_pattern = (new RegExp((""+"\\b"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(escaped)+"\\b\\s*=\\s*:value"),"i"));
var alias_match = sql.match(alias_pattern);
var col_expr = (cljs.core.truth_(alias_match)?(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((alias_match[(1)]))+"."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)):(cljs.core.truth_(cljs.core.re_find.call(null,bare_pattern,sql))?column:null
));
if(cljs.core.truth_(col_expr)){
var neutralized = (cljs.core.truth_(alias_match)?clojure.string.replace.call(null,sql,alias_pattern,"1 = 1"):clojure.string.replace.call(null,sql,bare_pattern,"1 = 1"));
var select_pattern = (new RegExp("select\\s+count\\(\\*\\)\\s+as\\s+HIT_COUNT","i"));
var inner = clojure.string.replace.call(null,neutralized,select_pattern,(""+"select "+"to_char("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(col_expr)+", 'YYYY-MM-DD HH24:MI:SS') as SAMPLE_FMT, "+"dump("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(col_expr)+") as SAMPLE_DUMP"));
if(cljs.core.not_EQ_.call(null,inner,sql)){
return (""+"select * from ("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(inner)+") where rownum <= 5");
} else {
return null;
}
} else {
return null;
}
} else {
return null;
}
});
/**
 * Keep only bind values whose ':name' placeholder still appears in the SQL.
 */
org.kp.kpmc.companion_rules.filter_binds_for_sql = (function org$kp$kpmc$companion_rules$filter_binds_for_sql(sql,binds){
var m = cljs.core.js__GT_clj.call(null,binds);
return cljs.core.clj__GT_js.call(null,cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.filter.call(null,(function (p__2080){
var vec__2081 = p__2080;
var k = cljs.core.nth.call(null,vec__2081,(0),null);
var _ = cljs.core.nth.call(null,vec__2081,(1),null);
return clojure.string.includes_QMARK_.call(null,sql,(""+":"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.name.call(null,k))));
}),m)));
});
/**
 * Run a diagnostic query for a failing date-column lookup and print the actual
 * DB date values (formatted + raw dump) so the stored format can be inspected.
 */
org.kp.kpmc.companion_rules.log_date_format_diagnostic_BANG_ = (function org$kp$kpmc$companion_rules$log_date_format_diagnostic_BANG_(db_config,sql,column,p__2084,binds){
var map__2085 = p__2084;
var map__2085__$1 = cljs.core.__destructure_map.call(null,map__2085);
var ctx = map__2085__$1;
var table = cljs.core.get.call(null,map__2085__$1,new cljs.core.Keyword(null,"table","table",-564943036));
var segment_ref = cljs.core.get.call(null,map__2085__$1,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482));
var edi_value = cljs.core.get.call(null,map__2085__$1,new cljs.core.Keyword(null,"edi-value","edi-value",-680186319));
var temp__5825__auto__ = org.kp.kpmc.companion_rules.build_date_sample_sql.call(null,sql,column);
if(cljs.core.truth_(temp__5825__auto__)){
var diag_sql = temp__5825__auto__;
var diag_binds = org.kp.kpmc.companion_rules.filter_binds_for_sql.call(null,diag_sql,binds);
var diag = org.kp.kpmc.companion_rules.execute_oracle_query_sync.call(null,db_config,diag_sql,diag_binds);
return cljs.core.println.call(null,"[date-format-diagnostic]",cljs.core.pr_str.call(null,new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"column","column",2078222095),column,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),segment_ref,new cljs.core.Keyword(null,"edi-value","edi-value",-680186319),edi_value,new cljs.core.Keyword(null,"ok","ok",967785236),new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(diag),new cljs.core.Keyword(null,"sample-rows","sample-rows",530983704),new cljs.core.Keyword(null,"rows","rows",850049680).cljs$core$IFn$_invoke$arity$1(diag),new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(diag)], null)));
} else {
return null;
}
});
org.kp.kpmc.companion_rules.build_input_ssn_cte = (function org$kp$kpmc$companion_rules$build_input_ssn_cte(ssns){
var indexed = cljs.core.vec.call(null,cljs.core.map_indexed.call(null,cljs.core.vector,ssns));
var rows = cljs.core.map.call(null,(function (p__2086){
var vec__2087 = p__2086;
var idx = cljs.core.nth.call(null,vec__2087,(0),null);
var _ = cljs.core.nth.call(null,vec__2087,(1),null);
if((idx === (0))){
return (""+"select :ssn_"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(idx)+" as ssn from dual");
} else {
return (""+"select :ssn_"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(idx)+" from dual");
}
}),indexed);
var binds = cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,(function (p__2090){
var vec__2091 = p__2090;
var idx = cljs.core.nth.call(null,vec__2091,(0),null);
var ssn = cljs.core.nth.call(null,vec__2091,(1),null);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.keyword.call(null,(""+"ssn_"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(idx))),ssn], null);
}),indexed));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"sql","sql",1251448786),clojure.string.join.call(null," union all ",rows),new cljs.core.Keyword(null,"binds","binds",363649660),cljs.core.clj__GT_js.call(null,binds)], null);
});
org.kp.kpmc.companion_rules.subscriber_bulk_select_sql = (function org$kp$kpmc$companion_rules$subscriber_bulk_select_sql(table,column){
if(((org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_.call(null,table)) && (org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_.call(null,column)))){
var t = org.kp.kpmc.companion_rules.safe_sql_literal.call(null,table);
var c = org.kp.kpmc.companion_rules.safe_sql_literal.call(null,column);
var value_expr = (function (){var G__2094 = column;
switch (G__2094) {
case "SUBSCRIBER_SSN":
return "replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')";

break;
case "IDENTIFICATION_VALUE":
return "replace(replace(t.IDENTIFICATION_VALUE, '-', ''), ' ', '')";

break;
default:
return (""+"to_char(t."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+")");

}
})();
var person_child = new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 5, ["TAP_PERSON_EMAIL",null,"TAP_PERSON_LANGUAGE",null,"TAP_PERSON_PHONE",null,"TAP_PERSON_EXTERNAL_IDENTIFIER",null,"TAP_PERSON_ADDRESS",null], null), null);
var person_coverage_child = new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 6, ["TAP_PERSON_COVERAGE_RIDER",null,"TAP_PERSON_COVERAGE_AFFILIATION",null,"TAP_PERSON_COVERAGE_ATTRIBUTE",null,"TAP_PERSON_COVERAGE_PREMIUM_RATE",null,"TAP_PERSON_COVERAGE_ADDRESS",null,"TAP_PERSON_COVERAGE_AFFILIATION_COMM",null], null), null);
if(cljs.core._EQ_.call(null,table,"TAP_COVERAGE")){
return (""+"select a.ssn as SSN, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(t)+"' as TABLE_NAME, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(c)+"' as COLUMN_NAME, "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(((cljs.core._EQ_.call(null,column,"SUBSCRIBER_SSN"))?"replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')":((clojure.string.ends_with_QMARK_.call(null,column,"_DATE"))?(""+"to_char(c."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+", 'YYYYMMDD')"):(""+"to_char(c."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+")"))))+" as VALUE "+"from anchor a "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "+"join MEMBER_OWNER.TAP_COVERAGE c on c.COVERAGE_ID = pc.COVERAGE_ID "+"where c."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" is not null");
} else {
if(cljs.core._EQ_.call(null,table,"TAP_PERSON")){
return (""+"select a.ssn as SSN, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(t)+"' as TABLE_NAME, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(c)+"' as COLUMN_NAME, "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(((clojure.string.ends_with_QMARK_.call(null,column,"_DATE"))?(""+"to_char(p."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+", 'YYYYMMDD')"):(""+"to_char(p."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+")")))+" as VALUE "+"from anchor a "+"join MEMBER_OWNER.TAP_PERSON p on p.PERSON_ID = a.PERSON_ID "+"where p."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" is not null");
} else {
if(cljs.core._EQ_.call(null,table,"TAP_PERSON_COVERAGE")){
return (""+"select a.ssn as SSN, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(t)+"' as TABLE_NAME, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(c)+"' as COLUMN_NAME, to_char(pc."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+") as VALUE "+"from anchor a "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "+"where pc."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" is not null");
} else {
if(cljs.core.contains_QMARK_.call(null,person_child,table)){
return (""+"select a.ssn as SSN, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(t)+"' as TABLE_NAME, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(c)+"' as COLUMN_NAME, "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(value_expr)+" as VALUE "+"from anchor a "+"join MEMBER_OWNER."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(table)+" t on t.PERSON_ID = a.PERSON_ID "+"where t."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" is not null");
} else {
if(cljs.core.contains_QMARK_.call(null,person_coverage_child,table)){
return (""+"select a.ssn as SSN, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(t)+"' as TABLE_NAME, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(c)+"' as COLUMN_NAME, to_char(t."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+") as VALUE "+"from anchor a "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "+"join MEMBER_OWNER."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(table)+" t on t.PERSON_ID = pc.PERSON_ID and t.COVERAGE_ID = pc.COVERAGE_ID "+"where t."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" is not null");
} else {
if(cljs.core._EQ_.call(null,table,"TAP_PLAN_GROUP")){
return (""+"select a.ssn as SSN, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(t)+"' as TABLE_NAME, '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(c)+"' as COLUMN_NAME, to_char(pg."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+") as VALUE "+"from anchor a "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.PERSON_ID = a.PERSON_ID "+"join MEMBER_OWNER.TAP_COVERAGE c on c.COVERAGE_ID = pc.COVERAGE_ID "+"join MEMBER_OWNER.TAP_PLAN_GROUP pg on pg.PLAN_GROUP_ID = c.PLAN_GROUP_ID "+"where pg."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" is not null");
} else {
return null;

}
}
}
}
}
}
} else {
return null;
}
});
org.kp.kpmc.companion_rules.build_subscriber_bulk_query = (function org$kp$kpmc$companion_rules$build_subscriber_bulk_query(ssns,lookup_doc){
var specs = cljs.core.vec.call(null,cljs.core.distinct.call(null,cljs.core.filter.call(null,(function (p__2096){
var vec__2097 = p__2096;
var t = cljs.core.nth.call(null,vec__2097,(0),null);
var c = cljs.core.nth.call(null,vec__2097,(1),null);
return ((org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_.call(null,t)) && (org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_.call(null,c)));
}),cljs.core.mapcat.call(null,(function (spec){
var targets = ((cljs.core.seq.call(null,new cljs.core.Keyword(null,"cases","cases",253862775).cljs$core$IFn$_invoke$arity$1(spec)))?new cljs.core.Keyword(null,"cases","cases",253862775).cljs$core$IFn$_invoke$arity$1(spec):new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [spec], null));
return cljs.core.map.call(null,(function (target){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(target),new cljs.core.Keyword(null,"column","column",2078222095).cljs$core$IFn$_invoke$arity$1(target)], null);
}),targets);
}),cljs.core.filter.call(null,new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc))))));
if(((cljs.core.seq.call(null,ssns)) && (cljs.core.seq.call(null,specs)))){
var map__2100 = org.kp.kpmc.companion_rules.build_input_ssn_cte.call(null,ssns);
var map__2100__$1 = cljs.core.__destructure_map.call(null,map__2100);
var sql = cljs.core.get.call(null,map__2100__$1,new cljs.core.Keyword(null,"sql","sql",1251448786));
var binds = cljs.core.get.call(null,map__2100__$1,new cljs.core.Keyword(null,"binds","binds",363649660));
var selects = cljs.core.vec.call(null,cljs.core.remove.call(null,cljs.core.nil_QMARK_,cljs.core.map.call(null,(function (p__2101){
var vec__2102 = p__2101;
var t = cljs.core.nth.call(null,vec__2102,(0),null);
var c = cljs.core.nth.call(null,vec__2102,(1),null);
return org.kp.kpmc.companion_rules.subscriber_bulk_select_sql.call(null,t,c);
}),specs)));
if(cljs.core.seq.call(null,selects)){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"sql","sql",1251448786),(""+"with input_ssn(ssn) as ("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(sql)+"), "+"anchor as ("+"select distinct i.ssn, pei.PERSON_ID "+"from input_ssn i "+"join MEMBER_OWNER.TAP_PERSON_EXTERNAL_IDENTIFIER pei "+"on pei.IDENTIFICATION_TYPE_CODE = 'SSN' "+"and replace(replace(pei.IDENTIFICATION_VALUE, '-', ''), ' ', '') = i.ssn"+") "+"select distinct SSN, TABLE_NAME, COLUMN_NAME, VALUE from ("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null," union all ",selects))+")"),new cljs.core.Keyword(null,"binds","binds",363649660),binds,new cljs.core.Keyword(null,"spec-count","spec-count",640286431),cljs.core.count.call(null,specs),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417),cljs.core.count.call(null,ssns)], null);
} else {
return null;
}
} else {
return null;
}
});
org.kp.kpmc.companion_rules.row_col = (function org$kp$kpmc$companion_rules$row_col(row,k){
var or__5142__auto__ = cljs.core.get.call(null,row,k);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = cljs.core.get.call(null,row,cljs.core.keyword.call(null,k));
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
var or__5142__auto____$2 = cljs.core.get.call(null,row,cljs.core.keyword.call(null,clojure.string.lower_case.call(null,k)));
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return cljs.core.get.call(null,row,cljs.core.keyword.call(null,clojure.string.upper_case.call(null,k)));
}
}
}
});
org.kp.kpmc.companion_rules.build_subscriber_prefetch_index = (function org$kp$kpmc$companion_rules$build_subscriber_prefetch_index(rows){
return cljs.core.reduce.call(null,(function (acc,row){
var ssn = org.kp.kpmc.companion_rules.normalize_ssn.call(null,(function (){var or__5142__auto__ = org.kp.kpmc.companion_rules.row_col.call(null,row,"SSN");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
var table = clojure.string.upper_case.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = org.kp.kpmc.companion_rules.row_col.call(null,row,"TABLE_NAME");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
var column = clojure.string.upper_case.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = org.kp.kpmc.companion_rules.row_col.call(null,row,"COLUMN_NAME");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
var value = org.kp.kpmc.companion_rules.normalize_lookup_value.call(null,column,(function (){var or__5142__auto__ = org.kp.kpmc.companion_rules.row_col.call(null,row,"VALUE");
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
if(((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,ssn)) || (((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,table)) || (((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,column)) || (org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value)))))))){
return acc;
} else {
return cljs.core.update_in.call(null,acc,new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [ssn,table,column], null),cljs.core.fnil.call(null,cljs.core.conj,cljs.core.PersistentHashSet.EMPTY),value);
}
}),cljs.core.PersistentArrayMap.EMPTY,rows);
});
org.kp.kpmc.companion_rules.load_subscriber_prefetch_data = (function org$kp$kpmc$companion_rules$load_subscriber_prefetch_data(db_config,parse_tree,lookup_doc){
var ssns = org.kp.kpmc.companion_rules.extract_subscriber_ssns_from_parse_tree.call(null,parse_tree);
var plan = org.kp.kpmc.companion_rules.build_subscriber_bulk_query.call(null,ssns,lookup_doc);
if((plan == null)){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"ok","ok",967785236),true,new cljs.core.Keyword(null,"values","values",372645556),cljs.core.PersistentArrayMap.EMPTY,new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417),cljs.core.count.call(null,ssns),new cljs.core.Keyword(null,"row-count","row-count",1060167988),(0),new cljs.core.Keyword(null,"spec-count","spec-count",640286431),(0)], null);
} else {
var q = org.kp.kpmc.companion_rules.execute_oracle_query_sync.call(null,db_config,new cljs.core.Keyword(null,"sql","sql",1251448786).cljs$core$IFn$_invoke$arity$1(plan),new cljs.core.Keyword(null,"binds","binds",363649660).cljs$core$IFn$_invoke$arity$1(plan),new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"fetch-all?","fetch-all?",1105533083),true], null));
if(cljs.core.truth_(new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(q))){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"ok","ok",967785236),true,new cljs.core.Keyword(null,"values","values",372645556),org.kp.kpmc.companion_rules.build_subscriber_prefetch_index.call(null,new cljs.core.Keyword(null,"rows","rows",850049680).cljs$core$IFn$_invoke$arity$1(q)),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417).cljs$core$IFn$_invoke$arity$1(plan),new cljs.core.Keyword(null,"spec-count","spec-count",640286431),new cljs.core.Keyword(null,"spec-count","spec-count",640286431).cljs$core$IFn$_invoke$arity$1(plan),new cljs.core.Keyword(null,"row-count","row-count",1060167988),new cljs.core.Keyword(null,"rowCount","rowCount",917416504).cljs$core$IFn$_invoke$arity$1(q)], null);
} else {
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"ok","ok",967785236),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(q),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417).cljs$core$IFn$_invoke$arity$1(plan),new cljs.core.Keyword(null,"spec-count","spec-count",640286431),new cljs.core.Keyword(null,"spec-count","spec-count",640286431).cljs$core$IFn$_invoke$arity$1(plan),new cljs.core.Keyword(null,"row-count","row-count",1060167988),(0)], null);
}
}
});
org.kp.kpmc.companion_rules.make_single_query_subscriber_executor = (function org$kp$kpmc$companion_rules$make_single_query_subscriber_executor(opts,prefetch_data){
var subscriber_only_QMARK_ = org.kp.kpmc.companion_rules.resolve_subscriber_only_db_validation_QMARK_.call(null,opts);
var supported_QMARK_ = (function (table,column){
return ((org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_.call(null,table)) && (((org.kp.kpmc.companion_rules.safe_sql_ident_QMARK_.call(null,column)) && ((!((org.kp.kpmc.companion_rules.subscriber_bulk_select_sql.call(null,table,column) == null)))))));
});
return (function (p__2105){
var map__2106 = p__2105;
var map__2106__$1 = cljs.core.__destructure_map.call(null,map__2106);
var spec = cljs.core.get.call(null,map__2106__$1,new cljs.core.Keyword(null,"spec","spec",347520401));
var value = cljs.core.get.call(null,map__2106__$1,new cljs.core.Keyword(null,"value","value",305978217));
var db_context = cljs.core.get.call(null,map__2106__$1,new cljs.core.Keyword(null,"db-context","db-context",371097239));
var scope = new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context);
var ssn = org.kp.kpmc.companion_rules.normalize_ssn.call(null,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(db_context));
var table = new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(spec);
var column = new cljs.core.Keyword(null,"column","column",2078222095).cljs$core$IFn$_invoke$arity$1(spec);
var normalized_value = org.kp.kpmc.companion_rules.normalize_lookup_value.call(null,column,value);
if(((subscriber_only_QMARK_) && (cljs.core.not_EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413))))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-non-subscriber-scope","skipped-non-subscriber-scope",-135438847),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"subscriber-only-db-validation","subscriber-only-db-validation",-1375507702)], null);
} else {
if(cljs.core.not_EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-non-subscriber-scope","skipped-non-subscriber-scope",-135438847),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"single-query-subscriber-mode","single-query-subscriber-mode",519387234)], null);
} else {
if(cljs.core.not.call(null,cljs.core.re_matches.call(null,/\d{9}/,ssn))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"missing-subscriber-ssn","missing-subscriber-ssn",-526376865),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"subscriber-lookups-require-ssn","subscriber-lookups-require-ssn",-743362013)], null);
} else {
if((!(supported_QMARK_.call(null,table,column)))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-unmapped-subscriber-attribute","skipped-unmapped-subscriber-attribute",-640602570),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"column","column",2078222095),column], null)], null);
} else {
if(cljs.core.not.call(null,new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(prefetch_data))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),true,new cljs.core.Keyword(null,"valid","valid",155614240),false,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"db-error","db-error",592028563),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(prefetch_data)], null);
} else {
var actual_values = cljs.core.get_in.call(null,prefetch_data,new cljs.core.PersistentVector(null, 4, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"values","values",372645556),ssn,table,column], null),cljs.core.PersistentHashSet.EMPTY);
var hit_QMARK_ = org.kp.kpmc.companion_rules.lookup_value_match_QMARK_.call(null,actual_values,normalized_value);
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"executed?","executed?",802143904),true,new cljs.core.Keyword(null,"valid","valid",155614240),hit_QMARK_,new cljs.core.Keyword(null,"status","status",-1997798413),((hit_QMARK_)?new cljs.core.Keyword(null,"db-hit","db-hit",-1530306888):new cljs.core.Keyword(null,"db-miss","db-miss",88930419)),new cljs.core.Keyword(null,"hit-count","hit-count",400844304),((hit_QMARK_)?(1):(0)),new cljs.core.Keyword(null,"scope","scope",-439358418),scope,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),ssn], null);

}
}
}
}
}
});
});
/**
 * Build SSN-anchored subscriber validation SQL for a mapped table/column.
 *       Returns nil when table strategy is not yet defined.
 */
org.kp.kpmc.companion_rules.subscriber_sql_by_table = (function org$kp$kpmc$companion_rules$subscriber_sql_by_table(table,column){
var person_child = new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 5, ["TAP_PERSON_EMAIL",null,"TAP_PERSON_LANGUAGE",null,"TAP_PERSON_PHONE",null,"TAP_PERSON_EXTERNAL_IDENTIFIER",null,"TAP_PERSON_ADDRESS",null], null), null);
var person_coverage_child = new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 6, ["TAP_PERSON_COVERAGE_RIDER",null,"TAP_PERSON_COVERAGE_AFFILIATION",null,"TAP_PERSON_COVERAGE_ATTRIBUTE",null,"TAP_PERSON_COVERAGE_PREMIUM_RATE",null,"TAP_PERSON_COVERAGE_ADDRESS",null,"TAP_PERSON_COVERAGE_AFFILIATION_COMM",null], null), null);
var ssn_expr = "replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')";
if(cljs.core._EQ_.call(null,table,"TAP_COVERAGE")){
return (""+"select count(*) as HIT_COUNT from MEMBER_OWNER.TAP_COVERAGE c "+"where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ssn_expr)+" = :ssn and "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(((cljs.core._EQ_.call(null,column,"SUBSCRIBER_SSN"))?"replace(replace(c.SUBSCRIBER_SSN, '-', ''), ' ', '')":(""+"c."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column))))+" = :value");
} else {
if(cljs.core._EQ_.call(null,table,"TAP_PERSON")){
return (""+"select count(*) as HIT_COUNT "+"from MEMBER_OWNER.TAP_COVERAGE c "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "+"join MEMBER_OWNER.TAP_PERSON p on p.PERSON_ID = pc.PERSON_ID "+"where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ssn_expr)+" = :ssn and p."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" = :value");
} else {
if(cljs.core._EQ_.call(null,table,"TAP_PERSON_COVERAGE")){
return (""+"select count(*) as HIT_COUNT "+"from MEMBER_OWNER.TAP_COVERAGE c "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "+"where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ssn_expr)+" = :ssn and pc."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" = :value");
} else {
if(cljs.core.contains_QMARK_.call(null,person_child,table)){
return (""+"select count(*) as HIT_COUNT "+"from MEMBER_OWNER.TAP_COVERAGE c "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "+"join MEMBER_OWNER."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(table)+" t on t.PERSON_ID = pc.PERSON_ID "+"where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ssn_expr)+" = :ssn and t."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" = :value");
} else {
if(cljs.core.contains_QMARK_.call(null,person_coverage_child,table)){
return (""+"select count(*) as HIT_COUNT "+"from MEMBER_OWNER.TAP_COVERAGE c "+"join MEMBER_OWNER.TAP_PERSON_COVERAGE pc on pc.COVERAGE_ID = c.COVERAGE_ID "+"join MEMBER_OWNER."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(table)+" t on t.PERSON_ID = pc.PERSON_ID and t.COVERAGE_ID = pc.COVERAGE_ID "+"where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ssn_expr)+" = :ssn and t."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" = :value");
} else {
if(cljs.core._EQ_.call(null,table,"TAP_PLAN_GROUP")){
return (""+"select count(*) as HIT_COUNT "+"from MEMBER_OWNER.TAP_COVERAGE c "+"join MEMBER_OWNER.TAP_PLAN_GROUP pg on pg.PLAN_GROUP_ID = c.PLAN_GROUP_ID "+"where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ssn_expr)+" = :ssn and pg."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" = :value");
} else {
return null;

}
}
}
}
}
}
});
org.kp.kpmc.companion_rules.make_oracle_lookup_executor = (function org$kp$kpmc$companion_rules$make_oracle_lookup_executor(opts){
var db_config = org.kp.kpmc.companion_rules.resolve_db_config.call(null,opts);
var subscriber_only_QMARK_ = org.kp.kpmc.companion_rules.resolve_subscriber_only_db_validation_QMARK_.call(null,opts);
return (function (p__2107){
var map__2108 = p__2107;
var map__2108__$1 = cljs.core.__destructure_map.call(null,map__2108);
var spec = cljs.core.get.call(null,map__2108__$1,new cljs.core.Keyword(null,"spec","spec",347520401));
var value = cljs.core.get.call(null,map__2108__$1,new cljs.core.Keyword(null,"value","value",305978217));
var db_context = cljs.core.get.call(null,map__2108__$1,new cljs.core.Keyword(null,"db-context","db-context",371097239));
var scope = new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context);
var ssn = new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(db_context);
var normalized_ssn = org.kp.kpmc.companion_rules.normalize_ssn.call(null,ssn);
var table = new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(spec);
var column = new cljs.core.Keyword(null,"column","column",2078222095).cljs$core$IFn$_invoke$arity$1(spec);
var segment_ref = new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(spec);
var text_value = (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = value;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()));
var normalized_value = org.kp.kpmc.companion_rules.normalize_lookup_value.call(null,column,text_value);
var subscriber_sql = org.kp.kpmc.companion_rules.subscriber_sql_by_table.call(null,table,column);
var commercial_query = ((((cljs.core._EQ_.call(null,table,"TAP_COVERAGE")) && (cljs.core._EQ_.call(null,column,"SUBSCRIBER_SSN"))))?new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"sql","sql",1251448786),"select count(*) as HIT_COUNT from MEMBER_OWNER.TAP_COVERAGE where replace(replace(SUBSCRIBER_SSN, '-', ''), ' ', '') = :value",new cljs.core.Keyword(null,"binds","binds",363649660),cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"value","value",305978217),org.kp.kpmc.companion_rules.normalize_ssn.call(null,text_value)], null))], null):new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"sql","sql",1251448786),(""+"select count(*) as HIT_COUNT from MEMBER_OWNER."+cljs.core.str.cljs$core$IFn$_invoke$arity$1(table)+" where "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+" = :value"),new cljs.core.Keyword(null,"binds","binds",363649660),cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"value","value",305978217),value], null))], null));
var sql = ((cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413)))?subscriber_sql:new cljs.core.Keyword(null,"sql","sql",1251448786).cljs$core$IFn$_invoke$arity$1(commercial_query));
if(clojure.string.starts_with_QMARK_.call(null,(function (){var or__5142__auto__ = table;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),"TAP_STAGING_")){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-staging-table","skipped-staging-table",192318800),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"column","column",2078222095),column], null)], null);
} else {
if((db_config == null)){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),false,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"db-config-missing","db-config-missing",1152491708),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"missing-env-name","missing-env-name",963723770)], null);
} else {
if(cljs.core.not.call(null,new cljs.core.Keyword(null,"valid?","valid?",-212412379).cljs$core$IFn$_invoke$arity$1(db_config))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),false,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"db-config-invalid","db-config-invalid",-973365429),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"env-name","env-name",1998966009),new cljs.core.Keyword(null,"env-name","env-name",1998966009).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"user-key","user-key",628459277),new cljs.core.Keyword(null,"user-key","user-key",628459277).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"password-key","password-key",-274998740),new cljs.core.Keyword(null,"password-key","password-key",-274998740).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"url-key","url-key",-154120626),new cljs.core.Keyword(null,"url-key","url-key",-154120626).cljs$core$IFn$_invoke$arity$1(db_config)], null)], null);
} else {
if(((subscriber_only_QMARK_) && (cljs.core.not_EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413))))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-non-subscriber-scope","skipped-non-subscriber-scope",-135438847),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"subscriber-only-db-validation","subscriber-only-db-validation",-1375507702)], null);
} else {
if(((cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413))) && (cljs.core.not.call(null,cljs.core.re_matches.call(null,/\d{9}/,normalized_ssn))))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"missing-subscriber-ssn","missing-subscriber-ssn",-526376865),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"subscriber-lookups-require-ssn","subscriber-lookups-require-ssn",-743362013)], null);
} else {
if(((cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413))) && ((sql == null)))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-unmapped-subscriber-attribute","skipped-unmapped-subscriber-attribute",-640602570),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"column","column",2078222095),column], null)], null);
} else {
var binds = ((cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413)))?cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"value","value",305978217),normalized_value,new cljs.core.Keyword(null,"ssn","ssn",1659668683),normalized_ssn], null)):new cljs.core.Keyword(null,"binds","binds",363649660).cljs$core$IFn$_invoke$arity$1(commercial_query));
var q_initial = org.kp.kpmc.companion_rules.execute_oracle_query_sync.call(null,db_config,sql,binds);
var date_error_QMARK_ = ((cljs.core.not.call(null,new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(q_initial))) && (cljs.core.boolean$.call(null,cljs.core.re_find.call(null,/ORA-01847|ORA-01861/,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(q_initial)))))));
var _ = ((date_error_QMARK_)?org.kp.kpmc.companion_rules.log_date_format_diagnostic_BANG_.call(null,db_config,sql,column,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),segment_ref,new cljs.core.Keyword(null,"edi-value","edi-value",-680186319),text_value], null),binds):null);
var date_safe_sql = ((date_error_QMARK_)?org.kp.kpmc.companion_rules.maybe_date_safe_sql.call(null,sql,column,text_value):null);
var q = (cljs.core.truth_(date_safe_sql)?org.kp.kpmc.companion_rules.execute_oracle_query_sync.call(null,db_config,date_safe_sql,binds):q_initial);
var hit = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"hitCount","hitCount",1989188482).cljs$core$IFn$_invoke$arity$1(q);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})();
var ok_QMARK_ = (function (){var and__5140__auto__ = new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(q);
if(cljs.core.truth_(and__5140__auto__)){
return (hit > (0));
} else {
return and__5140__auto__;
}
})();
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"executed?","executed?",802143904),true,new cljs.core.Keyword(null,"valid","valid",155614240),cljs.core.boolean$.call(null,ok_QMARK_),new cljs.core.Keyword(null,"status","status",-1997798413),(cljs.core.truth_(new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(q))?(cljs.core.truth_(ok_QMARK_)?new cljs.core.Keyword(null,"db-hit","db-hit",-1530306888):new cljs.core.Keyword(null,"db-miss","db-miss",88930419)):new cljs.core.Keyword(null,"db-error","db-error",592028563)),new cljs.core.Keyword(null,"hit-count","hit-count",400844304),hit,new cljs.core.Keyword(null,"scope","scope",-439358418),scope,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),((cljs.core._EQ_.call(null,scope,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413)))?normalized_ssn:null),new cljs.core.Keyword(null,"reason","reason",-2070751759),(cljs.core.truth_(new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(q))?null:new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(q)),new cljs.core.Keyword(null,"sql","sql",1251448786),(function (){var or__5142__auto__ = date_safe_sql;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return sql;
}
})()], null);

}
}
}
}
}
}
});
});
/**
 * Validate and return a canonical lookup document containing non-empty :specs.
 */
org.kp.kpmc.companion_rules.validate_lookup_doc = (function org$kp$kpmc$companion_rules$validate_lookup_doc(lookup_spec_file,lookup_doc){
if(cljs.core.map_QMARK_.call(null,lookup_doc)){
} else {
throw cljs.core.ex_info.call(null,"Lookup spec document must be an EDN map",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-lookup-document","invalid-lookup-document",-1693166869),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file], null));
}

if(cljs.core.contains_QMARK_.call(null,lookup_doc,new cljs.core.Keyword(null,"specs","specs",1426570741))){
} else {
throw cljs.core.ex_info.call(null,"Unsupported lookup schema: expected top-level :specs",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"unsupported-lookup-schema","unsupported-lookup-schema",1347995023),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file,new cljs.core.Keyword(null,"top-level-keys","top-level-keys",975558934),cljs.core.vec.call(null,cljs.core.keys.call(null,lookup_doc))], null));
}

var specs = new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc);
if(cljs.core.sequential_QMARK_.call(null,specs)){
} else {
throw cljs.core.ex_info.call(null,"Lookup :specs must be a collection",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-lookup-specs","invalid-lookup-specs",-2023604969),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file], null));
}

if(cljs.core.empty_QMARK_.call(null,specs)){
throw cljs.core.ex_info.call(null,"Lookup :specs must not be empty",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"empty-lookup-specs","empty-lookup-specs",-1526307675),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file], null));
} else {
}

var seq__2110_2130 = cljs.core.seq.call(null,cljs.core.map_indexed.call(null,cljs.core.vector,specs));
var chunk__2111_2131 = null;
var count__2112_2132 = (0);
var i__2113_2133 = (0);
while(true){
if((i__2113_2133 < count__2112_2132)){
var vec__2120_2134 = cljs.core._nth.call(null,chunk__2111_2131,i__2113_2133);
var idx_2135 = cljs.core.nth.call(null,vec__2120_2134,(0),null);
var spec_2136 = cljs.core.nth.call(null,vec__2120_2134,(1),null);
var missing_2137 = ((cljs.core.map_QMARK_.call(null,spec_2136))?cljs.core.vec.call(null,cljs.core.remove.call(null,((function (seq__2110_2130,chunk__2111_2131,count__2112_2132,i__2113_2133,vec__2120_2134,idx_2135,spec_2136,specs){
return (function (p1__2109_SHARP_){
return cljs.core.contains_QMARK_.call(null,spec_2136,p1__2109_SHARP_);
});})(seq__2110_2130,chunk__2111_2131,count__2112_2132,i__2113_2133,vec__2120_2134,idx_2135,spec_2136,specs))
,new cljs.core.PersistentVector(null, 6, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"id","id",-1388402092),new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838)], null))):new cljs.core.PersistentVector(null, 6, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"id","id",-1388402092),new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838)], null));
if((((!(cljs.core.map_QMARK_.call(null,spec_2136)))) || (cljs.core.seq.call(null,missing_2137)))){
throw cljs.core.ex_info.call(null,"Malformed lookup spec",new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"malformed-lookup-spec","malformed-lookup-spec",1601341117),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file,new cljs.core.Keyword(null,"spec-index","spec-index",-193403754),idx_2135,new cljs.core.Keyword(null,"missing-fields","missing-fields",-1030941726),missing_2137], null));
} else {
}


var G__2138 = seq__2110_2130;
var G__2139 = chunk__2111_2131;
var G__2140 = count__2112_2132;
var G__2141 = (i__2113_2133 + (1));
seq__2110_2130 = G__2138;
chunk__2111_2131 = G__2139;
count__2112_2132 = G__2140;
i__2113_2133 = G__2141;
continue;
} else {
var temp__5825__auto___2142 = cljs.core.seq.call(null,seq__2110_2130);
if(temp__5825__auto___2142){
var seq__2110_2143__$1 = temp__5825__auto___2142;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2110_2143__$1)){
var c__5673__auto___2144 = cljs.core.chunk_first.call(null,seq__2110_2143__$1);
var G__2145 = cljs.core.chunk_rest.call(null,seq__2110_2143__$1);
var G__2146 = c__5673__auto___2144;
var G__2147 = cljs.core.count.call(null,c__5673__auto___2144);
var G__2148 = (0);
seq__2110_2130 = G__2145;
chunk__2111_2131 = G__2146;
count__2112_2132 = G__2147;
i__2113_2133 = G__2148;
continue;
} else {
var vec__2123_2149 = cljs.core.first.call(null,seq__2110_2143__$1);
var idx_2150 = cljs.core.nth.call(null,vec__2123_2149,(0),null);
var spec_2151 = cljs.core.nth.call(null,vec__2123_2149,(1),null);
var missing_2152 = ((cljs.core.map_QMARK_.call(null,spec_2151))?cljs.core.vec.call(null,cljs.core.remove.call(null,((function (seq__2110_2130,chunk__2111_2131,count__2112_2132,i__2113_2133,vec__2123_2149,idx_2150,spec_2151,seq__2110_2143__$1,temp__5825__auto___2142,specs){
return (function (p1__2109_SHARP_){
return cljs.core.contains_QMARK_.call(null,spec_2151,p1__2109_SHARP_);
});})(seq__2110_2130,chunk__2111_2131,count__2112_2132,i__2113_2133,vec__2123_2149,idx_2150,spec_2151,seq__2110_2143__$1,temp__5825__auto___2142,specs))
,new cljs.core.PersistentVector(null, 6, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"id","id",-1388402092),new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838)], null))):new cljs.core.PersistentVector(null, 6, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"id","id",-1388402092),new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838)], null));
if((((!(cljs.core.map_QMARK_.call(null,spec_2151)))) || (cljs.core.seq.call(null,missing_2152)))){
throw cljs.core.ex_info.call(null,"Malformed lookup spec",new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"malformed-lookup-spec","malformed-lookup-spec",1601341117),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file,new cljs.core.Keyword(null,"spec-index","spec-index",-193403754),idx_2150,new cljs.core.Keyword(null,"missing-fields","missing-fields",-1030941726),missing_2152], null));
} else {
}


var G__2153 = cljs.core.next.call(null,seq__2110_2143__$1);
var G__2154 = null;
var G__2155 = (0);
var G__2156 = (0);
seq__2110_2130 = G__2153;
chunk__2111_2131 = G__2154;
count__2112_2132 = G__2155;
i__2113_2133 = G__2156;
continue;
}
} else {
}
}
break;
}

var key_fn_2157 = cljs.core.juxt.call(null,new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482));
var duplicate_keys_2158 = cljs.core.vec.call(null,cljs.core.keep.call(null,(function (p__2126){
var vec__2127 = p__2126;
var k = cljs.core.nth.call(null,vec__2127,(0),null);
var matching_specs = cljs.core.nth.call(null,vec__2127,(1),null);
if((cljs.core.count.call(null,matching_specs) > (1))){
return k;
} else {
return null;
}
}),cljs.core.group_by.call(null,key_fn_2157,specs)));
if(cljs.core.seq.call(null,duplicate_keys_2158)){
throw cljs.core.ex_info.call(null,"Duplicate lookup keys",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"duplicate-lookup-keys","duplicate-lookup-keys",-1528080815),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file,new cljs.core.Keyword(null,"duplicate-keys","duplicate-keys",1897604030),duplicate_keys_2158], null));
} else {
}

return cljs.core.assoc.call(null,lookup_doc,new cljs.core.Keyword(null,"specs","specs",1426570741),cljs.core.vec.call(null,specs));
});
/**
 * Load and validate canonical lookup specs EDN. Throws a typed error on failure.
 */
org.kp.kpmc.companion_rules.load_lookup_specs = (function org$kp$kpmc$companion_rules$load_lookup_specs(lookup_spec_file){
var text = (function (){try{return org.kp.kpmc.io_node.read_text.call(null,lookup_spec_file);
}catch (e2159){var cause = e2159;
throw cljs.core.ex_info.call(null,"Unable to read lookup spec file",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"lookup-file-error","lookup-file-error",814413005),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file], null),cause);
}})();
var lookup_doc = (function (){try{return cljs.reader.read_string.call(null,text);
}catch (e2160){var cause = e2160;
throw cljs.core.ex_info.call(null,"Unable to parse lookup spec EDN",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"lookup-parse-error","lookup-parse-error",1977042276),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),lookup_spec_file], null),cause);
}})();
return org.kp.kpmc.companion_rules.validate_lookup_doc.call(null,lookup_spec_file,lookup_doc);
});
/**
 * Build a lookup index keyed by [loop segment-id segment-ref].
 */
org.kp.kpmc.companion_rules.build_lookup_index = (function org$kp$kpmc$companion_rules$build_lookup_index(lookup_doc){
var specs = new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc);
return cljs.core.reduce.call(null,(function (acc,spec){
var k = new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"loop","loop",-395552849).cljs$core$IFn$_invoke$arity$1(spec),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(spec),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(spec)], null);
return cljs.core.assoc.call(null,acc,k,spec);
}),cljs.core.PersistentArrayMap.EMPTY,specs);
});
/**
 * Resolve best lookup spec for a rule. Prefer exact loop match, fallback to segment+ref match.
 */
org.kp.kpmc.companion_rules.find_lookup_spec = (function org$kp$kpmc$companion_rules$find_lookup_spec(lookup_index,rule){
var exact_k = new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(rule)], null);
var exact = cljs.core.get.call(null,lookup_index,exact_k);
if(cljs.core.truth_(exact)){
return exact;
} else {
return cljs.core.some.call(null,(function (p__2161){
var vec__2162 = p__2161;
var vec__2165 = cljs.core.nth.call(null,vec__2162,(0),null);
var _loop = cljs.core.nth.call(null,vec__2165,(0),null);
var seg = cljs.core.nth.call(null,vec__2165,(1),null);
var ref = cljs.core.nth.call(null,vec__2165,(2),null);
var spec = cljs.core.nth.call(null,vec__2162,(1),null);
if(((cljs.core._EQ_.call(null,seg,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(rule))) && (cljs.core._EQ_.call(null,ref,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(rule))))){
return spec;
} else {
return null;
}
}),lookup_index);
}
});
org.kp.kpmc.companion_rules.resolve_lookup_spec_case = (function org$kp$kpmc$companion_rules$resolve_lookup_spec_case(spec,db_context){
if(cljs.core.not.call(null,cljs.core.seq.call(null,new cljs.core.Keyword(null,"cases","cases",253862775).cljs$core$IFn$_invoke$arity$1(spec)))){
return spec;
} else {
var temp__5825__auto__ = cljs.core.some.call(null,(function (p__2168){
var map__2169 = p__2168;
var map__2169__$1 = cljs.core.__destructure_map.call(null,map__2169);
var lookup_case = map__2169__$1;
var when = cljs.core.get.call(null,map__2169__$1,new cljs.core.Keyword(null,"when","when",-576417306));
var map__2170 = when;
var map__2170__$1 = cljs.core.__destructure_map.call(null,map__2170);
var ref = cljs.core.get.call(null,map__2170__$1,new cljs.core.Keyword(null,"ref","ref",1289896967));
var equals = cljs.core.get.call(null,map__2170__$1,new cljs.core.Keyword(null,"equals","equals",-463033970));
var actual = clojure.string.trim.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = cljs.core.get.call(null,new cljs.core.Keyword(null,"refs","refs",-1560051448).cljs$core$IFn$_invoke$arity$1(db_context),ref);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})())));
return when.call(null,cljs.core._EQ_.call(null,actual,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(equals))),lookup_case);
}),new cljs.core.Keyword(null,"cases","cases",253862775).cljs$core$IFn$_invoke$arity$1(spec));
if(cljs.core.truth_(temp__5825__auto__)){
var matching_case = temp__5825__auto__;
return cljs.core.merge.call(null,cljs.core.dissoc.call(null,spec,new cljs.core.Keyword(null,"cases","cases",253862775)),cljs.core.dissoc.call(null,matching_case,new cljs.core.Keyword(null,"when","when",-576417306)));
} else {
return null;
}
}
});
/**
 * Default executor when no DB integration is provided yet.
 */
org.kp.kpmc.companion_rules.default_lookup_executor = (function org$kp$kpmc$companion_rules$default_lookup_executor(_){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"executed?","executed?",802143904),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"not-executed","not-executed",-1602466072),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"no-db-executor-configured","no-db-executor-configured",1097165657)], null);
});
org.kp.kpmc.companion_rules.evaluate_lookup = (function org$kp$kpmc$companion_rules$evaluate_lookup(p__2171,rule,value,db_context){
var map__2172 = p__2171;
var map__2172__$1 = cljs.core.__destructure_map.call(null,map__2172);
var lookup_index = cljs.core.get.call(null,map__2172__$1,new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582));
var lookup_executor = cljs.core.get.call(null,map__2172__$1,new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549));
var include_lookup_sql_QMARK_ = cljs.core.get.call(null,map__2172__$1,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460));
if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"skipped-blank","skipped-blank",1529224316)], null);
} else {
if((lookup_index == null)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"no-lookup-index","no-lookup-index",-1499095730)], null);
} else {
var indexed_spec = org.kp.kpmc.companion_rules.find_lookup_spec.call(null,lookup_index,rule);
var spec = (cljs.core.truth_(indexed_spec)?org.kp.kpmc.companion_rules.resolve_lookup_spec_case.call(null,indexed_spec,db_context):null);
if((indexed_spec == null)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"no-spec","no-spec",838519238)], null);
} else {
if((spec == null)){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766),false,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"condition-not-matched","condition-not-matched",-1458972791),new cljs.core.Keyword(null,"lookup-spec-id","lookup-spec-id",-228094302),new cljs.core.Keyword(null,"id","id",-1388402092).cljs$core$IFn$_invoke$arity$1(indexed_spec),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838).cljs$core$IFn$_invoke$arity$1(indexed_spec)], null);
} else {
if((!(new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057).cljs$core$IFn$_invoke$arity$1(spec) === true))){
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766),true,new cljs.core.Keyword(null,"valid","valid",155614240),true,new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"spec-disabled","spec-disabled",-241393383),new cljs.core.Keyword(null,"lookup-spec-id","lookup-spec-id",-228094302),new cljs.core.Keyword(null,"id","id",-1388402092).cljs$core$IFn$_invoke$arity$1(spec),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838).cljs$core$IFn$_invoke$arity$1(spec),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"disabled-reason","disabled-reason",-1615810409).cljs$core$IFn$_invoke$arity$1(spec)], null);
} else {
var exec_fn = (function (){var or__5142__auto__ = lookup_executor;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.companion_rules.default_lookup_executor;
}
})();
var exec_result = (function (){var or__5142__auto__ = exec_fn.call(null,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"spec","spec",347520401),spec,new cljs.core.Keyword(null,"rule","rule",729973257),rule,new cljs.core.Keyword(null,"value","value",305978217),value,new cljs.core.Keyword(null,"db-context","db-context",371097239),db_context], null));
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})();
var executed_QMARK_ = cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"executed?","executed?",802143904).cljs$core$IFn$_invoke$arity$1(exec_result));
var lookup_valid_QMARK_ = ((cljs.core.contains_QMARK_.call(null,exec_result,new cljs.core.Keyword(null,"valid","valid",155614240)))?cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(exec_result)):true);
var G__2173 = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"valid","valid",155614240),new cljs.core.Keyword(null,"executed?","executed?",802143904),new cljs.core.Keyword(null,"lookup-spec-id","lookup-spec-id",-228094302),new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766),new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838),new cljs.core.Keyword(null,"scope","scope",-439358418),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903)],[lookup_valid_QMARK_,executed_QMARK_,new cljs.core.Keyword(null,"id","id",-1388402092).cljs$core$IFn$_invoke$arity$1(spec),true,new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838).cljs$core$IFn$_invoke$arity$1(spec),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context),new cljs.core.Keyword(null,"reason","reason",-2070751759).cljs$core$IFn$_invoke$arity$1(exec_result),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(exec_result);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
if(executed_QMARK_){
return new cljs.core.Keyword(null,"executed","executed",-16905121);
} else {
return new cljs.core.Keyword(null,"not-executed","not-executed",-1602466072);
}
}
})(),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(db_context)]);
if(cljs.core.truth_(include_lookup_sql_QMARK_)){
return cljs.core.assoc.call(null,G__2173,new cljs.core.Keyword(null,"sql","sql",1251448786),cljs.core.get_in.call(null,spec,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"sql","sql",1251448786),new cljs.core.Keyword(null,"exists","exists",1312597120)], null)));
} else {
return G__2173;
}

}
}
}

}
}
});
/**
 * Run one compiled rule against a single element value and update stats/context.
 */
org.kp.kpmc.companion_rules.run_rule_on_value = (function org$kp$kpmc$companion_rules$run_rule_on_value(context_STAR_,stats_STAR_,db_state_STAR_,subscriber_progress_STAR_,maybe_heartbeat_fn,rule,seg_id,position,value,value_provided_QMARK_,lookup_state){
var ref = org.kp.kpmc.companion_rules.to_ref.call(null,seg_id,position);
var _ = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value))?null:cljs.core.swap_BANG_.call(null,context_STAR_,cljs.core.assoc,ref,value));
var ___$1 = org.kp.kpmc.companion_rules.update_db_state_BANG_.call(null,db_state_STAR_,cljs.core.deref.call(null,context_STAR_),rule,seg_id,position,value);
var db_context = cljs.core.update.call(null,org.kp.kpmc.companion_rules.current_db_context.call(null,db_state_STAR_,rule),new cljs.core.Keyword(null,"refs","refs",-1560051448),cljs.core.merge,cljs.core.deref.call(null,context_STAR_));
var result = new cljs.core.Keyword(null,"validate","validate",-201300827).cljs$core$IFn$_invoke$arity$1(rule).call(null,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"value","value",305978217),value,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),seg_id,new cljs.core.Keyword(null,"position","position",-2011731912),position,new cljs.core.Keyword(null,"context","context",-830191113),cljs.core.deref.call(null,context_STAR_)], null));
var lookup_result = org.kp.kpmc.companion_rules.evaluate_lookup.call(null,lookup_state,rule,value,db_context);
var rule_valid_QMARK_ = cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(result));
var valid_QMARK_ = ((rule_valid_QMARK_) && (cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(lookup_result))));
var annotation = (function (){var G__2174 = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"valid","valid",155614240),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-description","loop-description",120734501),new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.Keyword(null,"name","name",1843675177),new cljs.core.Keyword(null,"value","value",305978217),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"value-provided?","value-provided?",962391057),new cljs.core.Keyword(null,"rule-id","rule-id",426305841),new cljs.core.Keyword(null,"rule-kind","rule-kind",-1619689839),new cljs.core.Keyword(null,"segment","segment",-964921196)],[valid_QMARK_,new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(rule),lookup_result,new cljs.core.Keyword(null,"element-description","element-description",1941111197).cljs$core$IFn$_invoke$arity$1(rule),value,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(rule),value_provided_QMARK_,new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"kind","kind",-717265803).cljs$core$IFn$_invoke$arity$1(rule),seg_id]);
var G__2174__$1 = (cljs.core.truth_(new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327).cljs$core$IFn$_invoke$arity$1(rule))?cljs.core.assoc.call(null,G__2174,new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880),new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849),new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327).cljs$core$IFn$_invoke$arity$1(rule)):G__2174);
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context))){
return cljs.core.assoc.call(null,G__2174__$1,new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(db_context),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(db_context));
} else {
return G__2174__$1;
}
})();
cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update,new cljs.core.Keyword(null,"total","total",1916810418),cljs.core.inc);

cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update,((valid_QMARK_)?new cljs.core.Keyword(null,"passed","passed",-28165278):new cljs.core.Keyword(null,"failed","failed",-1397425762)),cljs.core.inc);

if(cljs.core.truth_(new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766).cljs$core$IFn$_invoke$arity$1(lookup_result))){
cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update_in,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.Keyword(null,"attempted","attempted",1101657210)], null),cljs.core.fnil.call(null,cljs.core.inc,(0)));

cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update_in,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"lookup","lookup",1225356838),(cljs.core.truth_(new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(lookup_result))?new cljs.core.Keyword(null,"passed","passed",-28165278):new cljs.core.Keyword(null,"failed","failed",-1397425762))], null),cljs.core.fnil.call(null,cljs.core.inc,(0)));
} else {
}

if(cljs.core.not.call(null,new cljs.core.Keyword(null,"lookup-applied","lookup-applied",1034021766).cljs$core$IFn$_invoke$arity$1(lookup_result))){
cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update_in,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.Keyword(null,"skipped","skipped",-1144887090)], null),cljs.core.fnil.call(null,cljs.core.inc,(0)));
} else {
}

cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update_in,new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"by-rule","by-rule",1219942905),new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"total","total",1916810418)], null),cljs.core.fnil.call(null,cljs.core.inc,(0)));

cljs.core.swap_BANG_.call(null,stats_STAR_,cljs.core.update_in,new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"by-rule","by-rule",1219942905),new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(rule),((valid_QMARK_)?new cljs.core.Keyword(null,"passed","passed",-28165278):new cljs.core.Keyword(null,"failed","failed",-1397425762))], null),cljs.core.fnil.call(null,cljs.core.inc,(0)));

if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context))){
var subscriber_index_2175 = new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(db_context);
var existing_2176 = (function (){var or__5142__auto__ = cljs.core.get.call(null,cljs.core.deref.call(null,subscriber_progress_STAR_),subscriber_index_2175);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.companion_rules.default_subscriber_progress.call(null,subscriber_index_2175,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(db_context));
}
})();
cljs.core.swap_BANG_.call(null,subscriber_progress_STAR_,cljs.core.assoc,subscriber_index_2175,org.kp.kpmc.companion_rules.update_subscriber_progress.call(null,existing_2176,rule_valid_QMARK_,lookup_result,db_context));

if(cljs.core.truth_(maybe_heartbeat_fn)){
var temp__5825__auto___2177 = cljs.core.get.call(null,cljs.core.deref.call(null,subscriber_progress_STAR_),subscriber_index_2175);
if(cljs.core.truth_(temp__5825__auto___2177)){
var next_sp_2178 = temp__5825__auto___2177;
maybe_heartbeat_fn.call(null,subscriber_index_2175,next_sp_2178);
} else {
}
} else {
}
} else {
}

if(valid_QMARK_){
return annotation;
} else {
return cljs.core.assoc.call(null,annotation,new cljs.core.Keyword(null,"invalid-description","invalid-description",97638859),cljs.core.pr_str.call(null,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"rule","rule",729973257),result,new cljs.core.Keyword(null,"lookup","lookup",1225356838),lookup_result], null)));
}
});
/**
 * Copy invalid annotations from a completed ISA tree into compact scalar maps.
 */
org.kp.kpmc.companion_rules.collect_invalid_findings = (function org$kp$kpmc$companion_rules$collect_invalid_findings(var_args){
var G__2180 = arguments.length;
switch (G__2180) {
case 2:
return org.kp.kpmc.companion_rules.collect_invalid_findings.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 3:
return org.kp.kpmc.companion_rules.collect_invalid_findings.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.collect_invalid_findings.cljs$core$IFn$_invoke$arity$2 = (function (annotated_tree,isa_index){
return org.kp.kpmc.companion_rules.collect_invalid_findings.call(null,annotated_tree,isa_index,false);
}));

(org.kp.kpmc.companion_rules.collect_invalid_findings.cljs$core$IFn$_invoke$arity$3 = (function (annotated_tree,isa_index,isa_context_already_entered_QMARK_){
var findings_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentVector.EMPTY);
var current_isa_index_STAR_ = cljs.core.atom.call(null,(cljs.core.truth_(isa_context_already_entered_QMARK_)?isa_index:(isa_index - (1))));
var add_finding_BANG_ = (function (annotation,segment,trail){
if(((cljs.core.map_QMARK_.call(null,annotation)) && (new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(annotation) === false))){
var ref = new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(annotation);
var reason = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"invalid-description","invalid-description",97638859).cljs$core$IFn$_invoke$arity$1(annotation);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = (function (){var G__2181 = annotation;
var G__2181__$1 = (((G__2181 == null))?null:new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(G__2181));
var G__2181__$2 = (((G__2181__$1 == null))?null:new cljs.core.Keyword(null,"reason","reason",-2070751759).cljs$core$IFn$_invoke$arity$1(G__2181__$1));
if((G__2181__$2 == null)){
return null;
} else {
return cljs.core.pr_str.call(null,G__2181__$2);
}
})();
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "Validation failed";
}
}
})();
var locator_trail = cljs.core.conj.call(null,trail,(function (){var or__5142__auto__ = ref;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = segment;
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "element";
}
}
})());
return cljs.core.swap_BANG_.call(null,findings_STAR_,cljs.core.conj,(function (){var G__2182 = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"path","path",-188191168),new cljs.core.Keyword(null,"failed-value","failed-value",-645422655),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-description","loop-description",120734501),new cljs.core.Keyword(null,"ref","ref",1289896967),new cljs.core.Keyword(null,"name","name",1843675177),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"segment","segment",-964921196),new cljs.core.Keyword(null,"locator-trail","locator-trail",116242646),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"value-provided","value-provided",-2062246661),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564)],[(""+"ISA["+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,current_isa_index_STAR_))+"]/"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"/",locator_trail))),new cljs.core.Keyword(null,"value","value",305978217).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"loop-description","loop-description",120734501).cljs$core$IFn$_invoke$arity$1(annotation),ref,new cljs.core.Keyword(null,"name","name",1843675177).cljs$core$IFn$_invoke$arity$1(annotation),reason,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"segment","segment",-964921196).cljs$core$IFn$_invoke$arity$1(annotation);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return segment;
}
})(),cljs.core.vec.call(null,locator_trail),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(annotation),cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"value-provided?","value-provided?",962391057).cljs$core$IFn$_invoke$arity$1(annotation)),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(annotation),cljs.core.deref.call(null,current_isa_index_STAR_)]);
if(cljs.core.truth_(new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327).cljs$core$IFn$_invoke$arity$1(annotation))){
return cljs.core.assoc.call(null,G__2182,new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880),new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849),new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327).cljs$core$IFn$_invoke$arity$1(annotation));
} else {
return G__2182;
}
})());
} else {
return null;
}
});
var walk = (function org$kp$kpmc$companion_rules$walk(node,trail,current_segment){
if(cljs.core.sequential_QMARK_.call(null,node)){
var tag = cljs.core.name.call(null,cljs.core.first.call(null,node));
var _ = ((cljs.core._EQ_.call(null,tag,"isa_data_segment"))?cljs.core.swap_BANG_.call(null,current_isa_index_STAR_,cljs.core.inc):null);
var segment = ((cljs.core._EQ_.call(null,tag,"data_segment"))?(function (){var or__5142__auto__ = org.kp.kpmc.companion_rules.extract_seg_id.call(null,node);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return current_segment;
}
})():((cljs.core._EQ_.call(null,tag,"raw_segment"))?(function (){var raw = ((cljs.core.map_QMARK_.call(null,cljs.core.second.call(null,node)))?cljs.core.nth.call(null,node,(2),null):cljs.core.second.call(null,node));
return cljs.core.first.call(null,org.kp.kpmc.companion_rules.split_raw_segment.call(null,raw));
})():current_segment
));
var node_meta = cljs.core.second.call(null,node);
var next_trail = ((cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 5, ["trans_body",null,"ins_subscriber",null,"x12file",null,"transaction_set",null,"functional_group",null], null), null),tag))?cljs.core.conj.call(null,trail,tag):trail);
if(((cljs.core._EQ_.call(null,tag,"raw_segment")) && (cljs.core.map_QMARK_.call(null,node_meta)))){
var seq__2183_2192 = cljs.core.seq.call(null,new cljs.core.Keyword(null,"element-validations","element-validations",1400120989).cljs$core$IFn$_invoke$arity$1(node_meta));
var chunk__2184_2193 = null;
var count__2185_2194 = (0);
var i__2186_2195 = (0);
while(true){
if((i__2186_2195 < count__2185_2194)){
var annotation_2196 = cljs.core._nth.call(null,chunk__2184_2193,i__2186_2195);
add_finding_BANG_.call(null,annotation_2196,segment,next_trail);


var G__2197 = seq__2183_2192;
var G__2198 = chunk__2184_2193;
var G__2199 = count__2185_2194;
var G__2200 = (i__2186_2195 + (1));
seq__2183_2192 = G__2197;
chunk__2184_2193 = G__2198;
count__2185_2194 = G__2199;
i__2186_2195 = G__2200;
continue;
} else {
var temp__5825__auto___2201 = cljs.core.seq.call(null,seq__2183_2192);
if(temp__5825__auto___2201){
var seq__2183_2202__$1 = temp__5825__auto___2201;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2183_2202__$1)){
var c__5673__auto___2203 = cljs.core.chunk_first.call(null,seq__2183_2202__$1);
var G__2204 = cljs.core.chunk_rest.call(null,seq__2183_2202__$1);
var G__2205 = c__5673__auto___2203;
var G__2206 = cljs.core.count.call(null,c__5673__auto___2203);
var G__2207 = (0);
seq__2183_2192 = G__2204;
chunk__2184_2193 = G__2205;
count__2185_2194 = G__2206;
i__2186_2195 = G__2207;
continue;
} else {
var annotation_2208 = cljs.core.first.call(null,seq__2183_2202__$1);
add_finding_BANG_.call(null,annotation_2208,segment,next_trail);


var G__2209 = cljs.core.next.call(null,seq__2183_2202__$1);
var G__2210 = null;
var G__2211 = (0);
var G__2212 = (0);
seq__2183_2192 = G__2209;
chunk__2184_2193 = G__2210;
count__2185_2194 = G__2211;
i__2186_2195 = G__2212;
continue;
}
} else {
}
}
break;
}
} else {
}

if(((cljs.core._EQ_.call(null,tag,"data_segment_unit")) && (cljs.core.map_QMARK_.call(null,node_meta)))){
add_finding_BANG_.call(null,node_meta,segment,next_trail);
} else {
}

var seq__2187 = cljs.core.seq.call(null,cljs.core.rest.call(null,node));
var chunk__2188 = null;
var count__2189 = (0);
var i__2190 = (0);
while(true){
if((i__2190 < count__2189)){
var child = cljs.core._nth.call(null,chunk__2188,i__2190);
org$kp$kpmc$companion_rules$walk.call(null,child,next_trail,segment);


var G__2213 = seq__2187;
var G__2214 = chunk__2188;
var G__2215 = count__2189;
var G__2216 = (i__2190 + (1));
seq__2187 = G__2213;
chunk__2188 = G__2214;
count__2189 = G__2215;
i__2190 = G__2216;
continue;
} else {
var temp__5825__auto__ = cljs.core.seq.call(null,seq__2187);
if(temp__5825__auto__){
var seq__2187__$1 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2187__$1)){
var c__5673__auto__ = cljs.core.chunk_first.call(null,seq__2187__$1);
var G__2217 = cljs.core.chunk_rest.call(null,seq__2187__$1);
var G__2218 = c__5673__auto__;
var G__2219 = cljs.core.count.call(null,c__5673__auto__);
var G__2220 = (0);
seq__2187 = G__2217;
chunk__2188 = G__2218;
count__2189 = G__2219;
i__2190 = G__2220;
continue;
} else {
var child = cljs.core.first.call(null,seq__2187__$1);
org$kp$kpmc$companion_rules$walk.call(null,child,next_trail,segment);


var G__2221 = cljs.core.next.call(null,seq__2187__$1);
var G__2222 = null;
var G__2223 = (0);
var G__2224 = (0);
seq__2187 = G__2221;
chunk__2188 = G__2222;
count__2189 = G__2223;
i__2190 = G__2224;
continue;
}
} else {
return null;
}
}
break;
}
} else {
return null;
}
});
walk.call(null,annotated_tree,cljs.core.PersistentVector.EMPTY,null);

return cljs.core.deref.call(null,findings_STAR_);
}));

(org.kp.kpmc.companion_rules.collect_invalid_findings.cljs$lang$maxFixedArity = 3);

/**
 * Run one rule without mutating global stats/context; returns [annotation next-context].
 */
org.kp.kpmc.companion_rules.run_rule_preview = (function org$kp$kpmc$companion_rules$run_rule_preview(context,rule,seg_id,position,value){
var ref = org.kp.kpmc.companion_rules.to_ref.call(null,seg_id,position);
var next_context = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,value))?context:cljs.core.assoc.call(null,context,ref,value));
var result = new cljs.core.Keyword(null,"validate","validate",-201300827).cljs$core$IFn$_invoke$arity$1(rule).call(null,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"value","value",305978217),value,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),seg_id,new cljs.core.Keyword(null,"position","position",-2011731912),position,new cljs.core.Keyword(null,"context","context",-830191113),next_context], null));
var valid_QMARK_ = cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(result));
var annotation = (function (){var G__2225 = new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"rule-id","rule-id",426305841),new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(rule),new cljs.core.Keyword(null,"valid","valid",155614240),valid_QMARK_,new cljs.core.Keyword(null,"rule-kind","rule-kind",-1619689839),new cljs.core.Keyword(null,"kind","kind",-717265803).cljs$core$IFn$_invoke$arity$1(rule)], null);
if((!(valid_QMARK_))){
return cljs.core.assoc.call(null,G__2225,new cljs.core.Keyword(null,"invalid-description","invalid-description",97638859),cljs.core.pr_str.call(null,result));
} else {
return G__2225;
}
})();
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [annotation,next_context], null);
});
/**
 * Map companion rules to their declared X12 element positions.
 */
org.kp.kpmc.companion_rules.transmitted_rules = (function org$kp$kpmc$companion_rules$transmitted_rules(rules){
return cljs.core.vec.call(null,cljs.core.map.call(null,(function (p1__2226_SHARP_){
return cljs.core.assoc.call(null,p1__2226_SHARP_,new cljs.core.Keyword(null,"edi-position","edi-position",493170166),new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(p1__2226_SHARP_));
}),cljs.core.sort_by.call(null,new cljs.core.Keyword(null,"position","position",-2011731912),rules)));
});
/**
 * Pick the first successful remaining loop definition in companion-guide order.
 * If none succeeds, pick the best remaining definition without moving backward.
 */
org.kp.kpmc.companion_rules.choose_loop_aware_rules = (function org$kp$kpmc$companion_rules$choose_loop_aware_rules(seg_id,values,seg_rules,context,eligible_loop_names,structural_resolution){
var rule_weight = (function (rule){
var G__2232 = new cljs.core.Keyword(null,"kind","kind",-717265803).cljs$core$IFn$_invoke$arity$1(rule);
var G__2232__$1 = (((G__2232 instanceof cljs.core.Keyword))?G__2232.fqn:null);
switch (G__2232__$1) {
case "cross-ref":
return (4);

break;
case "enum":
return (3);

break;
case "external-code-list":
return (2);

break;
case "pattern-hint":
return (2);

break;
case "literal":
return (2);

break;
case "placeholder":
return (1);

break;
case "open":
return (0);

break;
default:
return (1);

}
});
var groups = cljs.core.vec.call(null,cljs.core.map.call(null,(function (p__2233){
var vec__2234 = p__2233;
var _ = cljs.core.nth.call(null,vec__2234,(0),null);
var rs = cljs.core.nth.call(null,vec__2234,(1),null);
return org.kp.kpmc.companion_rules.transmitted_rules.call(null,rs);
}),cljs.core.sort_by.call(null,cljs.core.key,cljs.core.group_by.call(null,(function (r){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(r),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(r)], null);
}),seg_rules))));
var eligible_order = cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map_indexed.call(null,(function (idx,loop_name){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [loop_name,idx], null);
}),eligible_loop_names));
var eligible_groups = ((cljs.core.seq.call(null,eligible_loop_names))?cljs.core.vec.call(null,cljs.core.sort_by.call(null,(function (p1__2228_SHARP_){
return cljs.core.get.call(null,eligible_order,new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,p1__2228_SHARP_)));
}),cljs.core.filter.call(null,(function (p1__2227_SHARP_){
return cljs.core.contains_QMARK_.call(null,eligible_order,new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,p1__2227_SHARP_)));
}),groups))):groups);
var structural_loop_name = new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(structural_resolution);
var structural_groups = (cljs.core.truth_(structural_loop_name)?cljs.core.vec.call(null,cljs.core.filter.call(null,(function (p1__2229_SHARP_){
return cljs.core._EQ_.call(null,structural_loop_name,new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,p1__2229_SHARP_)));
}),groups)):null);
var candidate_groups = ((cljs.core.seq.call(null,structural_groups))?structural_groups:eligible_groups);
var selection_strategy = ((cljs.core.seq.call(null,structural_groups))?new cljs.core.Keyword(null,"structural-loop","structural-loop",-1372508912):new cljs.core.Keyword(null,"companion-order","companion-order",1105463307));
if((cljs.core.count.call(null,candidate_groups) <= (1))){
return cljs.core.mapv.call(null,(function (p1__2230_SHARP_){
return cljs.core.assoc.call(null,p1__2230_SHARP_,new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880),structural_loop_name,new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849),new cljs.core.Keyword(null,"loop-path","loop-path",100821809).cljs$core$IFn$_invoke$arity$1(structural_resolution),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327),selection_strategy);
}),cljs.core.first.call(null,candidate_groups));
} else {
var scored = cljs.core.map_indexed.call(null,(function (candidate_index,rules){
var result = cljs.core.reduce.call(null,(function (p__2237,rule){
var map__2238 = p__2237;
var map__2238__$1 = cljs.core.__destructure_map.call(null,map__2238);
var ctx = cljs.core.get.call(null,map__2238__$1,new cljs.core.Keyword(null,"ctx","ctx",-493610118));
var anns = cljs.core.get.call(null,map__2238__$1,new cljs.core.Keyword(null,"anns","anns",979004417));
var passed = cljs.core.get.call(null,map__2238__$1,new cljs.core.Keyword(null,"passed","passed",-28165278));
var failed = cljs.core.get.call(null,map__2238__$1,new cljs.core.Keyword(null,"failed","failed",-1397425762));
var pass_weight = cljs.core.get.call(null,map__2238__$1,new cljs.core.Keyword(null,"pass-weight","pass-weight",-1841056979));
var fail_weight = cljs.core.get.call(null,map__2238__$1,new cljs.core.Keyword(null,"fail-weight","fail-weight",-794544516));
var position = new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(rule);
var value = cljs.core.nth.call(null,values,(new cljs.core.Keyword(null,"edi-position","edi-position",493170166).cljs$core$IFn$_invoke$arity$1(rule) - (1)),null);
var vec__2239 = org.kp.kpmc.companion_rules.run_rule_preview.call(null,ctx,rule,seg_id,position,value);
var ann = cljs.core.nth.call(null,vec__2239,(0),null);
var next_ctx = cljs.core.nth.call(null,vec__2239,(1),null);
var w = rule_weight.call(null,rule);
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"ctx","ctx",-493610118),next_ctx,new cljs.core.Keyword(null,"anns","anns",979004417),cljs.core.conj.call(null,anns,ann),new cljs.core.Keyword(null,"passed","passed",-28165278),(cljs.core.truth_(new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(ann))?(passed + (1)):passed),new cljs.core.Keyword(null,"failed","failed",-1397425762),(cljs.core.truth_(new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(ann))?failed:(failed + (1))),new cljs.core.Keyword(null,"pass-weight","pass-weight",-1841056979),(cljs.core.truth_(new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(ann))?(pass_weight + w):pass_weight),new cljs.core.Keyword(null,"fail-weight","fail-weight",-794544516),(cljs.core.truth_(new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(ann))?fail_weight:(fail_weight + w))], null);
}),new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"ctx","ctx",-493610118),context,new cljs.core.Keyword(null,"anns","anns",979004417),cljs.core.PersistentVector.EMPTY,new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"pass-weight","pass-weight",-1841056979),(0),new cljs.core.Keyword(null,"fail-weight","fail-weight",-794544516),(0)], null),rules);
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"rules","rules",1198912366),rules,new cljs.core.Keyword(null,"passed","passed",-28165278),new cljs.core.Keyword(null,"passed","passed",-28165278).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"failed","failed",-1397425762),new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"score","score",-1963588780),new cljs.core.PersistentVector(null, 7, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"pass-weight","pass-weight",-1841056979).cljs$core$IFn$_invoke$arity$1(result),(- new cljs.core.Keyword(null,"fail-weight","fail-weight",-794544516).cljs$core$IFn$_invoke$arity$1(result)),((cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"required","required",1807647006),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,rules))))?(1):(0)),new cljs.core.Keyword(null,"passed","passed",-28165278).cljs$core$IFn$_invoke$arity$1(result),(- new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(result)),cljs.core.count.call(null,rules),(- candidate_index)], null)], null);
}),candidate_groups);
var discriminator_match = cljs.core.some.call(null,(function (p__2242){
var map__2243 = p__2242;
var map__2243__$1 = cljs.core.__destructure_map.call(null,map__2243);
var candidate = map__2243__$1;
var rules = cljs.core.get.call(null,map__2243__$1,new cljs.core.Keyword(null,"rules","rules",1198912366));
var rule = cljs.core.first.call(null,rules);
var position = new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(rule);
var value = cljs.core.nth.call(null,values,(new cljs.core.Keyword(null,"edi-position","edi-position",493170166).cljs$core$IFn$_invoke$arity$1(rule) - (1)),null);
var vec__2244 = org.kp.kpmc.companion_rules.run_rule_preview.call(null,context,rule,seg_id,position,value);
var annotation = cljs.core.nth.call(null,vec__2244,(0),null);
var _ = cljs.core.nth.call(null,vec__2244,(1),null);
if(cljs.core.truth_(new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(annotation))){
return candidate;
} else {
return null;
}
}),scored);
var best_scored = (function (){var or__5142__auto__ = discriminator_match;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.first.call(null,scored);
}
})();
return cljs.core.mapv.call(null,(function (p1__2231_SHARP_){
return cljs.core.assoc.call(null,p1__2231_SHARP_,new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880),structural_loop_name,new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849),new cljs.core.Keyword(null,"loop-path","loop-path",100821809).cljs$core$IFn$_invoke$arity$1(structural_resolution),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327),selection_strategy);
}),new cljs.core.Keyword(null,"rules","rules",1198912366).cljs$core$IFn$_invoke$arity$1(best_scored));
}
});
/**
 * Build companion-guide loop order and identify loops containing multiple
 * definitions of the same segment (e.g., REF variants in loop 2000).
 */
org.kp.kpmc.companion_rules.build_loop_order_by_segment = (function org$kp$kpmc$companion_rules$build_loop_order_by_segment(rules){
var with_loop = cljs.core.filter.call(null,(function (p__2249){
var map__2250 = p__2249;
var map__2250__$1 = cljs.core.__destructure_map.call(null,map__2250);
var segment_id = cljs.core.get.call(null,map__2250__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var loop_name = cljs.core.get.call(null,map__2250__$1,new cljs.core.Keyword(null,"loop-name","loop-name",468086403));
return (((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,segment_id)))) && ((!(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,loop_name)))));
}),rules);
var order_map = cljs.core.reduce.call(null,(function (acc,p__2251){
var map__2252 = p__2251;
var map__2252__$1 = cljs.core.__destructure_map.call(null,map__2252);
var segment_id = cljs.core.get.call(null,map__2252__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var loop_name = cljs.core.get.call(null,map__2252__$1,new cljs.core.Keyword(null,"loop-name","loop-name",468086403));
var existing = cljs.core.get.call(null,acc,segment_id,cljs.core.PersistentVector.EMPTY);
if(cljs.core.truth_(cljs.core.some.call(null,(function (p1__2248_SHARP_){
return cljs.core._EQ_.call(null,p1__2248_SHARP_,loop_name);
}),existing))){
return acc;
} else {
return cljs.core.assoc.call(null,acc,segment_id,cljs.core.conj.call(null,existing,loop_name));
}
}),cljs.core.PersistentArrayMap.EMPTY,with_loop);
var repeatable_loops = cljs.core.reduce.call(null,(function (acc,p__2253){
var vec__2254 = p__2253;
var vec__2257 = cljs.core.nth.call(null,vec__2254,(0),null);
var segment_id = cljs.core.nth.call(null,vec__2257,(0),null);
var _ = cljs.core.nth.call(null,vec__2257,(1),null);
var rs = cljs.core.nth.call(null,vec__2254,(1),null);
var variant_count = cljs.core.count.call(null,cljs.core.distinct.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),rs)));
if((variant_count > (1))){
return cljs.core.update.call(null,acc,segment_id,cljs.core.fnil.call(null,cljs.core.conj,cljs.core.PersistentHashSet.EMPTY),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,rs)));
} else {
return acc;
}
}),cljs.core.PersistentArrayMap.EMPTY,cljs.core.group_by.call(null,(function (p__2260){
var map__2261 = p__2260;
var map__2261__$1 = cljs.core.__destructure_map.call(null,map__2261);
var segment_id = cljs.core.get.call(null,map__2261__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var loop_name = cljs.core.get.call(null,map__2261__$1,new cljs.core.Keyword(null,"loop-name","loop-name",468086403));
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [segment_id,loop_name], null);
}),with_loop));
return cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,(function (p__2262){
var vec__2263 = p__2262;
var segment_id = cljs.core.nth.call(null,vec__2263,(0),null);
var order = cljs.core.nth.call(null,vec__2263,(1),null);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [segment_id,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"order","order",-1254677256),order,new cljs.core.Keyword(null,"repeatable-loops","repeatable-loops",124778007),cljs.core.get.call(null,repeatable_loops,segment_id,cljs.core.PersistentHashSet.EMPTY)], null)], null);
}),order_map));
});
/**
 * Return loops at or after the next allowed companion-guide position.
 * Multi-variant loops may repeat; selection never moves to an earlier loop.
 */
org.kp.kpmc.companion_rules.eligible_loop_names = (function org$kp$kpmc$companion_rules$eligible_loop_names(loop_order_by_seg,loop_position,seg_id){
var map__2266 = cljs.core.get.call(null,loop_order_by_seg,seg_id);
var map__2266__$1 = cljs.core.__destructure_map.call(null,map__2266);
var order = cljs.core.get.call(null,map__2266__$1,new cljs.core.Keyword(null,"order","order",-1254677256));
var repeatable_loops = cljs.core.get.call(null,map__2266__$1,new cljs.core.Keyword(null,"repeatable-loops","repeatable-loops",124778007));
var previous_position = cljs.core.get.call(null,loop_position,seg_id,(-1));
if(cljs.core.seq.call(null,order)){
var previous_loop = cljs.core.nth.call(null,order,previous_position,null);
var repeat_current_QMARK_ = cljs.core.contains_QMARK_.call(null,repeatable_loops,previous_loop);
var next_position = ((repeat_current_QMARK_)?previous_position:cljs.core.min.call(null,(previous_position + (1)),(cljs.core.count.call(null,order) - (1))));
return cljs.core.vec.call(null,cljs.core.drop.call(null,next_position,order));
} else {
return null;
}
});
org.kp.kpmc.companion_rules.record_loop_position = (function org$kp$kpmc$companion_rules$record_loop_position(loop_position,loop_order_by_seg,seg_id,active_rules){
var map__2269 = cljs.core.get.call(null,loop_order_by_seg,seg_id);
var map__2269__$1 = cljs.core.__destructure_map.call(null,map__2269);
var order = cljs.core.get.call(null,map__2269__$1,new cljs.core.Keyword(null,"order","order",-1254677256));
var selected_loop = new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,active_rules));
var selected_position = cljs.core.first.call(null,cljs.core.keep_indexed.call(null,(function (p1__2268_SHARP_,p2__2267_SHARP_){
if(cljs.core._EQ_.call(null,p2__2267_SHARP_,selected_loop)){
return p1__2268_SHARP_;
} else {
return null;
}
}),order));
if((!((selected_position == null)))){
return cljs.core.assoc.call(null,loop_position,seg_id,selected_position);
} else {
return loop_position;
}
});
/**
 * Validate parsed EDI tree using compiled rules and annotate data units with :valid.
 * Works with keyword-tag or string-tag parse trees.
 */
org.kp.kpmc.companion_rules.validate_edi_parse_tree = (function org$kp$kpmc$companion_rules$validate_edi_parse_tree(var_args){
var G__2271 = arguments.length;
switch (G__2271) {
case 2:
return org.kp.kpmc.companion_rules.validate_edi_parse_tree.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 3:
return org.kp.kpmc.companion_rules.validate_edi_parse_tree.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.validate_edi_parse_tree.cljs$core$IFn$_invoke$arity$2 = (function (parse_tree,rules){
return org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.companion_rules.validate_edi_parse_tree.cljs$core$IFn$_invoke$arity$3 = (function (parse_tree,rules,opts){
var rules_by_seg = cljs.core.group_by.call(null,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),rules);
var loop_order_by_seg = org.kp.kpmc.companion_rules.build_loop_order_by_segment.call(null,rules);
var seg_occurrence_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentArrayMap.EMPTY);
var loop_position_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentArrayMap.EMPTY);
var context_STAR_ = cljs.core.atom.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"initial-context","initial-context",-32910095).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})());
var db_state_STAR_ = cljs.core.atom.call(null,new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"initial-commercial-refs","initial-commercial-refs",-1051283619).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})(),new cljs.core.Keyword(null,"subscribers","subscribers",-606401562),cljs.core.PersistentVector.EMPTY,new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804),cljs.core.vec.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"subscriberSsns","subscriberSsns",-1246886607).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return cljs.core.PersistentVector.EMPTY;
}
}
})()),new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),null], null));
var subscriber_progress_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentArrayMap.EMPTY);
var subscriber_statuses_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentVector.EMPTY);
var finalized_subscribers_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentHashSet.EMPTY);
var heartbeat_attempts_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentArrayMap.EMPTY);
var isa_index_STAR_ = cljs.core.atom.call(null,(cljs.core.truth_(new cljs.core.Keyword(null,"isa-context-already-entered?","isa-context-already-entered?",531867840).cljs$core$IFn$_invoke$arity$1(opts))?(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"isa-index","isa-index",1189721564).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (1);
}
})():((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"isa-index","isa-index",1189721564).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (1);
}
})() - (1))));
var direct_findings_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentVector.EMPTY);
var annotate_tree_QMARK_ = (!(new cljs.core.Keyword(null,"annotate-tree?","annotate-tree?",1971190655).cljs$core$IFn$_invoke$arity$1(opts) === false));
var finding_trail = cljs.core.vec.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"finding-trail","finding-trail",-1427155948).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentVector.EMPTY;
}
})());
var record_invalid_finding_BANG_ = (function (annotation,segment){
if(cljs.core.truth_((function (){var and__5140__auto__ = new cljs.core.Keyword(null,"collect-invalid-findings-during-validation?","collect-invalid-findings-during-validation?",-2114132055).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(and__5140__auto__)){
return ((cljs.core.map_QMARK_.call(null,annotation)) && (new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(annotation) === false));
} else {
return and__5140__auto__;
}
})())){
var ref = new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(annotation);
var reason = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"invalid-description","invalid-description",97638859).cljs$core$IFn$_invoke$arity$1(annotation);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = (function (){var G__2272 = annotation;
var G__2272__$1 = (((G__2272 == null))?null:new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(G__2272));
var G__2272__$2 = (((G__2272__$1 == null))?null:new cljs.core.Keyword(null,"reason","reason",-2070751759).cljs$core$IFn$_invoke$arity$1(G__2272__$1));
if((G__2272__$2 == null)){
return null;
} else {
return cljs.core.pr_str.call(null,G__2272__$2);
}
})();
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "Validation failed";
}
}
})();
var locator_trail = cljs.core.conj.call(null,finding_trail,(function (){var or__5142__auto__ = ref;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = segment;
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "element";
}
}
})());
return cljs.core.swap_BANG_.call(null,direct_findings_STAR_,cljs.core.conj,(function (){var G__2273 = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"path","path",-188191168),new cljs.core.Keyword(null,"failed-value","failed-value",-645422655),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-description","loop-description",120734501),new cljs.core.Keyword(null,"ref","ref",1289896967),new cljs.core.Keyword(null,"name","name",1843675177),new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"segment","segment",-964921196),new cljs.core.Keyword(null,"locator-trail","locator-trail",116242646),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"value-provided","value-provided",-2062246661),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564)],[(""+"ISA["+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,isa_index_STAR_))+"]/"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"/",locator_trail))),new cljs.core.Keyword(null,"value","value",305978217).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"loop-description","loop-description",120734501).cljs$core$IFn$_invoke$arity$1(annotation),ref,new cljs.core.Keyword(null,"name","name",1843675177).cljs$core$IFn$_invoke$arity$1(annotation),reason,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"segment","segment",-964921196).cljs$core$IFn$_invoke$arity$1(annotation);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return segment;
}
})(),locator_trail,new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(annotation),cljs.core.boolean$.call(null,new cljs.core.Keyword(null,"value-provided?","value-provided?",962391057).cljs$core$IFn$_invoke$arity$1(annotation)),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(annotation),cljs.core.deref.call(null,isa_index_STAR_)]);
if(cljs.core.truth_(new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327).cljs$core$IFn$_invoke$arity$1(annotation))){
return cljs.core.assoc.call(null,G__2273,new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880),new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849),new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849).cljs$core$IFn$_invoke$arity$1(annotation),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327),new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327).cljs$core$IFn$_invoke$arity$1(annotation));
} else {
return G__2273;
}
})());
} else {
return null;
}
});
var stats_STAR_ = cljs.core.atom.call(null,new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"total","total",1916810418),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"by-rule","by-rule",1219942905),cljs.core.PersistentArrayMap.EMPTY,new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"attempted","attempted",1101657210),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"skipped","skipped",-1144887090),(0)], null)], null));
var started_ms = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"started-ms","started-ms",1106122505).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.companion_rules.now_ms.call(null);
}
})();
var started_at = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"started-at","started-at",1318767912).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.companion_rules.now_iso.call(null);
}
})();
var run_id = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"run-id","run-id",-1745267908).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"runId","runId",505587730).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.random_uuid.call(null)));
}
}
})();
var heartbeat_every = org.kp.kpmc.companion_rules.normalize_heartbeat_every.call(null,opts);
var total_subscribers = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"totalSubscribers","totalSubscribers",-1502855776).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
var or__5142__auto____$2 = org.kp.kpmc.companion_rules.count_ins_segments.call(null,parse_tree);
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return (0);
}
}
}
})();
var db_validation_enabled_QMARK_ = new cljs.core.Keyword(null,"db-validation-enabled?","db-validation-enabled?",19180651).cljs$core$IFn$_invoke$arity$1(opts) === true;
var structural_loop_resolver = new cljs.core.Keyword(null,"structural-loop-resolver","structural-loop-resolver",-1220853782).cljs$core$IFn$_invoke$arity$1(opts);
var lookup_state = new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582),new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582).cljs$core$IFn$_invoke$arity$1(opts),new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549),new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549).cljs$core$IFn$_invoke$arity$1(opts),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460).cljs$core$IFn$_invoke$arity$1(opts) === true], null);
var _ = (((!(new cljs.core.Keyword(null,"initialize-progress-file?","initialize-progress-file?",223942229).cljs$core$IFn$_invoke$arity$1(opts) === false)))?org.kp.kpmc.companion_rules.init_progress_file_BANG_.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})()):null);
var maybe_emit_heartbeat_BANG_ = (function (subscriber_index,subscriber_progress){
var attempted = new cljs.core.Keyword(null,"db-attempted","db-attempted",1408905196).cljs$core$IFn$_invoke$arity$1(subscriber_progress);
var last_attempted = cljs.core.get.call(null,cljs.core.deref.call(null,heartbeat_attempts_STAR_),subscriber_index);
if((((heartbeat_every > (0))) && ((((attempted > (0))) && ((((cljs.core.mod.call(null,attempted,heartbeat_every) === (0))) && (cljs.core.not_EQ_.call(null,attempted,last_attempted)))))))){
cljs.core.swap_BANG_.call(null,heartbeat_attempts_STAR_,cljs.core.assoc,subscriber_index,attempted);

var safe_total = cljs.core.max.call(null,(1),total_subscribers);
var processed_count = ((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + cljs.core.count.call(null,cljs.core.deref.call(null,subscriber_statuses_STAR_)));
var percent_complete = cljs.core.min.call(null,(100),Math.round(((100) * (processed_count / safe_total))));
var event = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170),new cljs.core.Keyword(null,"db","db",993250759),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"subscriber-key","subscriber-key",-1702623888),new cljs.core.Keyword(null,"processed-subscribers","processed-subscribers",256578928),new cljs.core.Keyword(null,"percent-complete","percent-complete",-1380641104),new cljs.core.Keyword(null,"structure","structure",1563832083),new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"event-type","event-type",319722813)],[total_subscribers,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"attempted","attempted",1101657210),new cljs.core.Keyword(null,"db-attempted","db-attempted",1408905196).cljs$core$IFn$_invoke$arity$1(subscriber_progress),new cljs.core.Keyword(null,"passed","passed",-28165278),new cljs.core.Keyword(null,"db-passed","db-passed",198436552).cljs$core$IFn$_invoke$arity$1(subscriber_progress),new cljs.core.Keyword(null,"failed","failed",-1397425762),new cljs.core.Keyword(null,"db-failed","db-failed",2141279772).cljs$core$IFn$_invoke$arity$1(subscriber_progress),new cljs.core.Keyword(null,"skipped","skipped",-1144887090),new cljs.core.Keyword(null,"db-skipped","db-skipped",-943014801).cljs$core$IFn$_invoke$arity$1(subscriber_progress)], null),new cljs.core.Keyword(null,"started-at","started-at",1318767912).cljs$core$IFn$_invoke$arity$1(subscriber_progress),org.kp.kpmc.companion_rules.build_subscriber_key.call(null,subscriber_index,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(subscriber_progress),run_id),processed_count,percent_complete,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"total","total",1916810418),new cljs.core.Keyword(null,"structure-total","structure-total",-952958790).cljs$core$IFn$_invoke$arity$1(subscriber_progress),new cljs.core.Keyword(null,"passed","passed",-28165278),new cljs.core.Keyword(null,"structure-passed","structure-passed",-480953573).cljs$core$IFn$_invoke$arity$1(subscriber_progress),new cljs.core.Keyword(null,"failed","failed",-1397425762),new cljs.core.Keyword(null,"structure-failed","structure-failed",-313903498).cljs$core$IFn$_invoke$arity$1(subscriber_progress)], null),"db-validating",subscriber_index,(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(subscriber_progress),cljs.core.deref.call(null,isa_index_STAR_),run_id,"subscriber-heartbeat"]);
return org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,opts,event);
} else {
return null;
}
});
var finalize_subscriber_BANG_ = (function (subscriber_index){
if(cljs.core.truth_((function (){var and__5140__auto__ = subscriber_index;
if(cljs.core.truth_(and__5140__auto__)){
return (!(cljs.core.contains_QMARK_.call(null,cljs.core.deref.call(null,finalized_subscribers_STAR_),subscriber_index)));
} else {
return and__5140__auto__;
}
})())){
var sp = (function (){var or__5142__auto__ = cljs.core.get.call(null,cljs.core.deref.call(null,subscriber_progress_STAR_),subscriber_index);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.companion_rules.default_subscriber_progress.call(null,subscriber_index,null);
}
})();
var status = org.kp.kpmc.companion_rules.subscriber_final_status.call(null,sp,db_validation_enabled_QMARK_);
var completed_at = org.kp.kpmc.companion_rules.now_iso.call(null);
var processed_count = ((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (cljs.core.count.call(null,cljs.core.deref.call(null,subscriber_statuses_STAR_)) + (1)));
var safe_total = cljs.core.max.call(null,(1),total_subscribers);
var percent_complete = cljs.core.min.call(null,(100),Math.round(((100) * (processed_count / safe_total))));
var event = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170),new cljs.core.Keyword(null,"db","db",993250759),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"failure-reasons","failure-reasons",287546828),new cljs.core.Keyword(null,"subscriber-key","subscriber-key",-1702623888),new cljs.core.Keyword(null,"processed-subscribers","processed-subscribers",256578928),new cljs.core.Keyword(null,"percent-complete","percent-complete",-1380641104),new cljs.core.Keyword(null,"structure","structure",1563832083),new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"completed-at","completed-at",-1210511048),new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"event-type","event-type",319722813),new cljs.core.Keyword(null,"lookup-status-counts","lookup-status-counts",-335990626)],[total_subscribers,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"attempted","attempted",1101657210),new cljs.core.Keyword(null,"db-attempted","db-attempted",1408905196).cljs$core$IFn$_invoke$arity$1(sp),new cljs.core.Keyword(null,"passed","passed",-28165278),new cljs.core.Keyword(null,"db-passed","db-passed",198436552).cljs$core$IFn$_invoke$arity$1(sp),new cljs.core.Keyword(null,"failed","failed",-1397425762),new cljs.core.Keyword(null,"db-failed","db-failed",2141279772).cljs$core$IFn$_invoke$arity$1(sp),new cljs.core.Keyword(null,"skipped","skipped",-1144887090),new cljs.core.Keyword(null,"db-skipped","db-skipped",-943014801).cljs$core$IFn$_invoke$arity$1(sp)], null),new cljs.core.Keyword(null,"started-at","started-at",1318767912).cljs$core$IFn$_invoke$arity$1(sp),cljs.core.vec.call(null,cljs.core.remove.call(null,cljs.core.nil_QMARK_,new cljs.core.Keyword(null,"failure-reasons","failure-reasons",287546828).cljs$core$IFn$_invoke$arity$1(sp))),org.kp.kpmc.companion_rules.build_subscriber_key.call(null,subscriber_index,new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(sp),run_id),processed_count,percent_complete,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"total","total",1916810418),new cljs.core.Keyword(null,"structure-total","structure-total",-952958790).cljs$core$IFn$_invoke$arity$1(sp),new cljs.core.Keyword(null,"passed","passed",-28165278),new cljs.core.Keyword(null,"structure-passed","structure-passed",-480953573).cljs$core$IFn$_invoke$arity$1(sp),new cljs.core.Keyword(null,"failed","failed",-1397425762),new cljs.core.Keyword(null,"structure-failed","structure-failed",-313903498).cljs$core$IFn$_invoke$arity$1(sp)], null),status,subscriber_index,completed_at,(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms),new cljs.core.Keyword(null,"subscriber-ssn","subscriber-ssn",-1013411620).cljs$core$IFn$_invoke$arity$1(sp),cljs.core.deref.call(null,isa_index_STAR_),run_id,"subscriber-completed",new cljs.core.Keyword(null,"lookup-status-counts","lookup-status-counts",-335990626).cljs$core$IFn$_invoke$arity$1(sp)]);
cljs.core.swap_BANG_.call(null,finalized_subscribers_STAR_,cljs.core.conj,subscriber_index);

cljs.core.swap_BANG_.call(null,subscriber_statuses_STAR_,cljs.core.conj,event);

cljs.core.swap_BANG_.call(null,subscriber_progress_STAR_,cljs.core.dissoc,subscriber_index);

cljs.core.swap_BANG_.call(null,heartbeat_attempts_STAR_,cljs.core.dissoc,subscriber_index);

org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,opts,event);

return org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"validate:after-subscriber-db-and-status",new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),subscriber_index,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.reduce.call(null,cljs.core._PLUS_,(0),cljs.core.vals.call(null,cljs.core.deref.call(null,seg_occurrence_STAR_))),new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,stats_STAR_)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,cljs.core.deref.call(null,subscriber_statuses_STAR_)),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()], null));
} else {
return null;
}
});
var enrich = (function org$kp$kpmc$companion_rules$enrich(node){
if((!(cljs.core.sequential_QMARK_.call(null,node)))){
return node;
} else {
if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"isa_data_segment")){
if(cljs.core.truth_(structural_loop_resolver)){
structural_loop_resolver.call(null,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"event","event",301435442),new cljs.core.Keyword(null,"reset","reset",-800929946),new cljs.core.Keyword(null,"scope","scope",-439358418),new cljs.core.Keyword(null,"isa","isa",-936573243)], null));
} else {
}

cljs.core.reset_BANG_.call(null,seg_occurrence_STAR_,cljs.core.PersistentArrayMap.EMPTY);

cljs.core.reset_BANG_.call(null,loop_position_STAR_,cljs.core.PersistentArrayMap.EMPTY);

cljs.core.reset_BANG_.call(null,context_STAR_,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"initial-context","initial-context",-32910095).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})());

cljs.core.swap_BANG_.call(null,db_state_STAR_,cljs.core.assoc,new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"initial-commercial-refs","initial-commercial-refs",-1051283619).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})());
} else {
}

if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"data_segment")){
var seg_id = org.kp.kpmc.companion_rules.extract_seg_id.call(null,node);
var values = org.kp.kpmc.companion_rules.extract_unit_values.call(null,node);
var ___$1 = ((cljs.core._EQ_.call(null,seg_id,"INS"))?(function (){
finalize_subscriber_BANG_.call(null,cljs.core.get_in.call(null,cljs.core.deref.call(null,db_state_STAR_),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"index","index",-1531685915)], null)));

cljs.core.reset_BANG_.call(null,seg_occurrence_STAR_,cljs.core.PersistentArrayMap.EMPTY);

cljs.core.reset_BANG_.call(null,loop_position_STAR_,cljs.core.PersistentArrayMap.EMPTY);

return cljs.core.reset_BANG_.call(null,context_STAR_,new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,db_state_STAR_)));
})()
:null);
var ___$2 = cljs.core.swap_BANG_.call(null,seg_occurrence_STAR_,cljs.core.update,seg_id,cljs.core.fnil.call(null,cljs.core.inc,(0)));
var seg_rules = cljs.core.sort_by.call(null,new cljs.core.Keyword(null,"position","position",-2011731912),cljs.core.get.call(null,rules_by_seg,seg_id,cljs.core.PersistentVector.EMPTY));
var eligible_loops = org.kp.kpmc.companion_rules.eligible_loop_names.call(null,loop_order_by_seg,cljs.core.deref.call(null,loop_position_STAR_),seg_id);
var structural_resolution = (cljs.core.truth_(structural_loop_resolver)?structural_loop_resolver.call(null,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"event","event",301435442),new cljs.core.Keyword(null,"segment","segment",-964921196),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),seg_id,new cljs.core.Keyword(null,"values","values",372645556),values], null)):null);
var active_rules = org.kp.kpmc.companion_rules.choose_loop_aware_rules.call(null,seg_id,values,seg_rules,cljs.core.deref.call(null,context_STAR_),eligible_loops,structural_resolution);
var ___$3 = cljs.core.swap_BANG_.call(null,loop_position_STAR_,org.kp.kpmc.companion_rules.record_loop_position,loop_order_by_seg,seg_id,active_rules);
var children = cljs.core.vec.call(null,cljs.core.rest.call(null,node));
var unit_idxs = cljs.core.vec.call(null,cljs.core.map.call(null,cljs.core.first,cljs.core.filter.call(null,(function (p__2274){
var vec__2275 = p__2274;
var ___$4 = cljs.core.nth.call(null,vec__2275,(0),null);
var c = cljs.core.nth.call(null,vec__2275,(1),null);
return org.kp.kpmc.companion_rules.tag_EQ_.call(null,c,"data_segment_unit");
}),cljs.core.map_indexed.call(null,cljs.core.vector,children))));
var pos__GT_rule = cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,cljs.core.juxt.call(null,new cljs.core.Keyword(null,"edi-position","edi-position",493170166),cljs.core.identity),active_rules));
var new_children = cljs.core.reduce.call(null,(function (acc,p__2278){
var vec__2279 = p__2278;
var pos = cljs.core.nth.call(null,vec__2279,(0),null);
var unit_index = cljs.core.nth.call(null,vec__2279,(1),null);
var position = (pos + (1));
var unit = cljs.core.nth.call(null,acc,unit_index);
var value = cljs.core.nth.call(null,values,pos,null);
var rule = cljs.core.get.call(null,pos__GT_rule,position);
if((rule == null)){
return acc;
} else {
var semantic_position = new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(rule);
var annotation = org.kp.kpmc.companion_rules.run_rule_on_value.call(null,context_STAR_,stats_STAR_,db_state_STAR_,subscriber_progress_STAR_,maybe_emit_heartbeat_BANG_,rule,seg_id,semantic_position,value,true,lookup_state);
record_invalid_finding_BANG_.call(null,annotation,seg_id);

if(annotate_tree_QMARK_){
return cljs.core.assoc.call(null,acc,unit_index,org.kp.kpmc.companion_rules.annotate_unit.call(null,unit,annotation));
} else {
return acc;
}
}
}),children,cljs.core.map_indexed.call(null,cljs.core.vector,unit_idxs));
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$companion_rules$enrich,new_children));
} else {
if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"raw_segment")){
var raw_text = cljs.core.second.call(null,node);
var vec__2282 = org.kp.kpmc.companion_rules.split_raw_segment.call(null,raw_text);
var seg_id = cljs.core.nth.call(null,vec__2282,(0),null);
var values = cljs.core.nth.call(null,vec__2282,(1),null);
var ___$1 = ((cljs.core._EQ_.call(null,seg_id,"INS"))?(function (){
finalize_subscriber_BANG_.call(null,cljs.core.get_in.call(null,cljs.core.deref.call(null,db_state_STAR_),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"index","index",-1531685915)], null)));

cljs.core.reset_BANG_.call(null,seg_occurrence_STAR_,cljs.core.PersistentArrayMap.EMPTY);

cljs.core.reset_BANG_.call(null,loop_position_STAR_,cljs.core.PersistentArrayMap.EMPTY);

return cljs.core.reset_BANG_.call(null,context_STAR_,new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,db_state_STAR_)));
})()
:null);
var ___$2 = cljs.core.swap_BANG_.call(null,seg_occurrence_STAR_,cljs.core.update,seg_id,cljs.core.fnil.call(null,cljs.core.inc,(0)));
var seg_rules = cljs.core.sort_by.call(null,new cljs.core.Keyword(null,"position","position",-2011731912),cljs.core.get.call(null,rules_by_seg,seg_id,cljs.core.PersistentVector.EMPTY));
var eligible_loops = org.kp.kpmc.companion_rules.eligible_loop_names.call(null,loop_order_by_seg,cljs.core.deref.call(null,loop_position_STAR_),seg_id);
var structural_resolution = (cljs.core.truth_(structural_loop_resolver)?structural_loop_resolver.call(null,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"event","event",301435442),new cljs.core.Keyword(null,"segment","segment",-964921196),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),seg_id,new cljs.core.Keyword(null,"values","values",372645556),values], null)):null);
var active_rules = org.kp.kpmc.companion_rules.choose_loop_aware_rules.call(null,seg_id,values,seg_rules,cljs.core.deref.call(null,context_STAR_),eligible_loops,structural_resolution);
var ___$3 = cljs.core.swap_BANG_.call(null,loop_position_STAR_,org.kp.kpmc.companion_rules.record_loop_position,loop_order_by_seg,seg_id,active_rules);
var annotations = cljs.core.vec.call(null,cljs.core.map.call(null,(function (rule){
var position = new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(rule);
var edi_position = new cljs.core.Keyword(null,"edi-position","edi-position",493170166).cljs$core$IFn$_invoke$arity$1(rule);
var value = cljs.core.nth.call(null,values,(edi_position - (1)),null);
return org.kp.kpmc.companion_rules.run_rule_on_value.call(null,context_STAR_,stats_STAR_,db_state_STAR_,subscriber_progress_STAR_,maybe_emit_heartbeat_BANG_,rule,seg_id,position,value,(edi_position <= cljs.core.count.call(null,values)),lookup_state);
}),active_rules));
var ___$4 = (function (){var seq__2285 = cljs.core.seq.call(null,annotations);
var chunk__2286 = null;
var count__2287 = (0);
var i__2288 = (0);
while(true){
if((i__2288 < count__2287)){
var annotation = cljs.core._nth.call(null,chunk__2286,i__2288);
record_invalid_finding_BANG_.call(null,annotation,seg_id);


var G__2290 = seq__2285;
var G__2291 = chunk__2286;
var G__2292 = count__2287;
var G__2293 = (i__2288 + (1));
seq__2285 = G__2290;
chunk__2286 = G__2291;
count__2287 = G__2292;
i__2288 = G__2293;
continue;
} else {
var temp__5825__auto__ = cljs.core.seq.call(null,seq__2285);
if(temp__5825__auto__){
var seq__2285__$1 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2285__$1)){
var c__5673__auto__ = cljs.core.chunk_first.call(null,seq__2285__$1);
var G__2294 = cljs.core.chunk_rest.call(null,seq__2285__$1);
var G__2295 = c__5673__auto__;
var G__2296 = cljs.core.count.call(null,c__5673__auto__);
var G__2297 = (0);
seq__2285 = G__2294;
chunk__2286 = G__2295;
count__2287 = G__2296;
i__2288 = G__2297;
continue;
} else {
var annotation = cljs.core.first.call(null,seq__2285__$1);
record_invalid_finding_BANG_.call(null,annotation,seg_id);


var G__2298 = cljs.core.next.call(null,seq__2285__$1);
var G__2299 = null;
var G__2300 = (0);
var G__2301 = (0);
seq__2285 = G__2298;
chunk__2286 = G__2299;
count__2287 = G__2300;
i__2288 = G__2301;
continue;
}
} else {
return null;
}
}
break;
}
})();
var segment_valid_QMARK_ = cljs.core.every_QMARK_.call(null,new cljs.core.Keyword(null,"valid","valid",155614240),annotations);
if(((annotate_tree_QMARK_) && (cljs.core.seq.call(null,annotations)))){
return new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node),new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),seg_id,new cljs.core.Keyword(null,"expected-loop","expected-loop",145159168),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,active_rules)),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,active_rules)),new cljs.core.Keyword(null,"loop-description","loop-description",120734501),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,active_rules)),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,active_rules)),new cljs.core.Keyword(null,"validated-count","validated-count",1468561061),cljs.core.count.call(null,annotations),new cljs.core.Keyword(null,"valid","valid",155614240),segment_valid_QMARK_,new cljs.core.Keyword(null,"element-validations","element-validations",1400120989),annotations], null),raw_text], null);
} else {
return node;
}
} else {
var annotated = cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$companion_rules$enrich,cljs.core.rest.call(null,node)));
if(org.kp.kpmc.companion_rules.tag_EQ_.call(null,node,"isa_data_segment")){
var isa_index_2302 = cljs.core.swap_BANG_.call(null,isa_index_STAR_,cljs.core.inc);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"validate:after-isa-header-validation",new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index_2302,new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),cljs.core.get_in.call(null,cljs.core.deref.call(null,db_state_STAR_),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"index","index",-1531685915)], null)),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.reduce.call(null,cljs.core._PLUS_,(0),cljs.core.vals.call(null,cljs.core.deref.call(null,seg_occurrence_STAR_))),new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,stats_STAR_)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,cljs.core.deref.call(null,subscriber_statuses_STAR_)),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()], null));
} else {
}

return annotated;

}
}
}
});
var annotated_tree = enrich.call(null,parse_tree);
var ___$1 = finalize_subscriber_BANG_.call(null,cljs.core.get_in.call(null,cljs.core.deref.call(null,db_state_STAR_),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"index","index",-1531685915)], null)));
var subscriber_statuses = cljs.core.deref.call(null,subscriber_statuses_STAR_);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"validate:after-findings-merged",new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),cljs.core.get_in.call(null,cljs.core.deref.call(null,db_state_STAR_),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038),new cljs.core.Keyword(null,"index","index",-1531685915)], null)),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.reduce.call(null,cljs.core._PLUS_,(0),cljs.core.vals.call(null,cljs.core.deref.call(null,seg_occurrence_STAR_))),new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,stats_STAR_)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,subscriber_statuses),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()], null));

return cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989),new cljs.core.Keyword(null,"context","context",-830191113),new cljs.core.Keyword(null,"db-state","db-state",1624009049),new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"stats","stats",-85643011),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078)],[subscriber_statuses,started_at,((annotate_tree_QMARK_)?annotated_tree:null),org.kp.kpmc.companion_rules.build_subscriber_progress_summary.call(null,subscriber_statuses),cljs.core.deref.call(null,context_STAR_),cljs.core.deref.call(null,db_state_STAR_),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms),run_id,cljs.core.deref.call(null,stats_STAR_),cljs.core.deref.call(null,direct_findings_STAR_)]);
}));

(org.kp.kpmc.companion_rules.validate_edi_parse_tree.cljs$lang$maxFixedArity = 3);

/**
 * Validate parsed EDI JSON text (array-based parse tree with string tags).
 * Returns cljs map including annotated tree and summary stats.
 */
org.kp.kpmc.companion_rules.validate_parsed_json_text = (function org$kp$kpmc$companion_rules$validate_parsed_json_text(parsed_json_text,rules){
var parsed = JSON.parse(parsed_json_text);
var parse_tree = cljs.core.js__GT_clj.call(null,parsed);
return org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules);
});
/**
 * Collect flattened lookup outcomes from annotated tree in traversal order.
 */
org.kp.kpmc.companion_rules.collect_lookup_outcomes = (function org$kp$kpmc$companion_rules$collect_lookup_outcomes(annotated_tree){
var acc_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentVector.EMPTY);
var walk = (function org$kp$kpmc$companion_rules$collect_lookup_outcomes_$_walk(node){
if(cljs.core.sequential_QMARK_.call(null,node)){
var meta_2311 = cljs.core.second.call(null,node);
if(((cljs.core.map_QMARK_.call(null,meta_2311)) && (cljs.core.vector_QMARK_.call(null,new cljs.core.Keyword(null,"element-validations","element-validations",1400120989).cljs$core$IFn$_invoke$arity$1(meta_2311))))){
var seq__2303_2312 = cljs.core.seq.call(null,new cljs.core.Keyword(null,"element-validations","element-validations",1400120989).cljs$core$IFn$_invoke$arity$1(meta_2311));
var chunk__2304_2313 = null;
var count__2305_2314 = (0);
var i__2306_2315 = (0);
while(true){
if((i__2306_2315 < count__2305_2314)){
var ev_2316 = cljs.core._nth.call(null,chunk__2304_2313,i__2306_2315);
var lookup_2317 = new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(ev_2316);
if(cljs.core.map_QMARK_.call(null,lookup_2317)){
cljs.core.swap_BANG_.call(null,acc_STAR_,cljs.core.conj,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(ev_2316),new cljs.core.Keyword(null,"rule-id","rule-id",426305841),new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(ev_2316),new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(lookup_2317),new cljs.core.Keyword(null,"valid","valid",155614240),new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(lookup_2317),new cljs.core.Keyword(null,"scope","scope",-439358418),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(lookup_2317),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(lookup_2317)], null));
} else {
}


var G__2318 = seq__2303_2312;
var G__2319 = chunk__2304_2313;
var G__2320 = count__2305_2314;
var G__2321 = (i__2306_2315 + (1));
seq__2303_2312 = G__2318;
chunk__2304_2313 = G__2319;
count__2305_2314 = G__2320;
i__2306_2315 = G__2321;
continue;
} else {
var temp__5825__auto___2322 = cljs.core.seq.call(null,seq__2303_2312);
if(temp__5825__auto___2322){
var seq__2303_2323__$1 = temp__5825__auto___2322;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2303_2323__$1)){
var c__5673__auto___2324 = cljs.core.chunk_first.call(null,seq__2303_2323__$1);
var G__2325 = cljs.core.chunk_rest.call(null,seq__2303_2323__$1);
var G__2326 = c__5673__auto___2324;
var G__2327 = cljs.core.count.call(null,c__5673__auto___2324);
var G__2328 = (0);
seq__2303_2312 = G__2325;
chunk__2304_2313 = G__2326;
count__2305_2314 = G__2327;
i__2306_2315 = G__2328;
continue;
} else {
var ev_2329 = cljs.core.first.call(null,seq__2303_2323__$1);
var lookup_2330 = new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(ev_2329);
if(cljs.core.map_QMARK_.call(null,lookup_2330)){
cljs.core.swap_BANG_.call(null,acc_STAR_,cljs.core.conj,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(ev_2329),new cljs.core.Keyword(null,"rule-id","rule-id",426305841),new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(ev_2329),new cljs.core.Keyword(null,"status","status",-1997798413),new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(lookup_2330),new cljs.core.Keyword(null,"valid","valid",155614240),new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(lookup_2330),new cljs.core.Keyword(null,"scope","scope",-439358418),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(lookup_2330),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(lookup_2330)], null));
} else {
}


var G__2331 = cljs.core.next.call(null,seq__2303_2323__$1);
var G__2332 = null;
var G__2333 = (0);
var G__2334 = (0);
seq__2303_2312 = G__2331;
chunk__2304_2313 = G__2332;
count__2305_2314 = G__2333;
i__2306_2315 = G__2334;
continue;
}
} else {
}
}
break;
}
} else {
}

var seq__2307 = cljs.core.seq.call(null,cljs.core.rest.call(null,node));
var chunk__2308 = null;
var count__2309 = (0);
var i__2310 = (0);
while(true){
if((i__2310 < count__2309)){
var c = cljs.core._nth.call(null,chunk__2308,i__2310);
org$kp$kpmc$companion_rules$collect_lookup_outcomes_$_walk.call(null,c);


var G__2335 = seq__2307;
var G__2336 = chunk__2308;
var G__2337 = count__2309;
var G__2338 = (i__2310 + (1));
seq__2307 = G__2335;
chunk__2308 = G__2336;
count__2309 = G__2337;
i__2310 = G__2338;
continue;
} else {
var temp__5825__auto__ = cljs.core.seq.call(null,seq__2307);
if(temp__5825__auto__){
var seq__2307__$1 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2307__$1)){
var c__5673__auto__ = cljs.core.chunk_first.call(null,seq__2307__$1);
var G__2339 = cljs.core.chunk_rest.call(null,seq__2307__$1);
var G__2340 = c__5673__auto__;
var G__2341 = cljs.core.count.call(null,c__5673__auto__);
var G__2342 = (0);
seq__2307 = G__2339;
chunk__2308 = G__2340;
count__2309 = G__2341;
i__2310 = G__2342;
continue;
} else {
var c = cljs.core.first.call(null,seq__2307__$1);
org$kp$kpmc$companion_rules$collect_lookup_outcomes_$_walk.call(null,c);


var G__2343 = cljs.core.next.call(null,seq__2307__$1);
var G__2344 = null;
var G__2345 = (0);
var G__2346 = (0);
seq__2307 = G__2343;
chunk__2308 = G__2344;
count__2309 = G__2345;
i__2310 = G__2346;
continue;
}
} else {
return null;
}
}
break;
}
} else {
return null;
}
});
walk.call(null,annotated_tree);

return cljs.core.deref.call(null,acc_STAR_);
});
/**
 * Compare two flattened lookup-outcome vectors and summarize mismatches.
 */
org.kp.kpmc.companion_rules.compare_lookup_outcomes = (function org$kp$kpmc$companion_rules$compare_lookup_outcomes(legacy_outcomes,single_outcomes){
var n = cljs.core.min.call(null,cljs.core.count.call(null,legacy_outcomes),cljs.core.count.call(null,single_outcomes));
var pairs = cljs.core.map.call(null,cljs.core.vector,cljs.core.take.call(null,n,legacy_outcomes),cljs.core.take.call(null,n,single_outcomes));
var mismatches = cljs.core.vec.call(null,cljs.core.keep_indexed.call(null,(function (idx,p__2347){
var vec__2348 = p__2347;
var l = cljs.core.nth.call(null,vec__2348,(0),null);
var s = cljs.core.nth.call(null,vec__2348,(1),null);
if(((cljs.core.not_EQ_.call(null,new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(s))) || (cljs.core.not_EQ_.call(null,new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(s))))){
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"index","index",-1531685915),idx,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"rule-id","rule-id",426305841),new cljs.core.Keyword(null,"rule-id","rule-id",426305841).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"legacy-status","legacy-status",-2142225699),new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"single-status","single-status",2043309119),new cljs.core.Keyword(null,"status","status",-1997798413).cljs$core$IFn$_invoke$arity$1(s),new cljs.core.Keyword(null,"legacy-valid","legacy-valid",740829942),new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(l),new cljs.core.Keyword(null,"single-valid","single-valid",2121318161),new cljs.core.Keyword(null,"valid","valid",155614240).cljs$core$IFn$_invoke$arity$1(s)], null);
} else {
return null;
}
}),pairs));
var mismatch_by_segment = cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,(function (p__2351){
var vec__2352 = p__2351;
var k = cljs.core.nth.call(null,vec__2352,(0),null);
var vs = cljs.core.nth.call(null,vec__2352,(1),null);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [k,cljs.core.count.call(null,vs)], null);
})),cljs.core.group_by.call(null,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),mismatches));
var mismatch_by_rule = cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,(function (p__2355){
var vec__2356 = p__2355;
var k = cljs.core.nth.call(null,vec__2356,(0),null);
var vs = cljs.core.nth.call(null,vec__2356,(1),null);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [k,cljs.core.count.call(null,vs)], null);
})),cljs.core.group_by.call(null,new cljs.core.Keyword(null,"rule-id","rule-id",426305841),mismatches));
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"legacy-count","legacy-count",1976464452),cljs.core.count.call(null,legacy_outcomes),new cljs.core.Keyword(null,"single-count","single-count",-1765620100),cljs.core.count.call(null,single_outcomes),new cljs.core.Keyword(null,"compared-count","compared-count",-2011072646),n,new cljs.core.Keyword(null,"length-delta","length-delta",-1516594855),(cljs.core.count.call(null,single_outcomes) - cljs.core.count.call(null,legacy_outcomes)),new cljs.core.Keyword(null,"mismatch-count","mismatch-count",1959684515),cljs.core.count.call(null,mismatches),new cljs.core.Keyword(null,"mismatch-count-by-segment-ref","mismatch-count-by-segment-ref",-183732194),mismatch_by_segment,new cljs.core.Keyword(null,"mismatch-count-by-rule-id","mismatch-count-by-rule-id",412132757),mismatch_by_rule,new cljs.core.Keyword(null,"mismatch-samples","mismatch-samples",-84816597),cljs.core.vec.call(null,cljs.core.take.call(null,(25),mismatches))], null);
});
org.kp.kpmc.companion_rules.merge_validation_stats = (function org$kp$kpmc$companion_rules$merge_validation_stats(left,right){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"total","total",1916810418),((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"total","total",1916810418).cljs$core$IFn$_invoke$arity$1(left);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"total","total",1916810418).cljs$core$IFn$_invoke$arity$1(right);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()),new cljs.core.Keyword(null,"passed","passed",-28165278),((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"passed","passed",-28165278).cljs$core$IFn$_invoke$arity$1(left);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"passed","passed",-28165278).cljs$core$IFn$_invoke$arity$1(right);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()),new cljs.core.Keyword(null,"failed","failed",-1397425762),((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(left);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(right);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()),new cljs.core.Keyword(null,"lookup","lookup",1225356838),cljs.core.merge_with.call(null,cljs.core._PLUS_,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"attempted","attempted",1101657210),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"skipped","skipped",-1144887090),(0)], null),new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(left),new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(right)),new cljs.core.Keyword(null,"by-rule","by-rule",1219942905),cljs.core.merge_with.call(null,(function (a,b){
return cljs.core.merge_with.call(null,cljs.core._PLUS_,a,b);
}),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"by-rule","by-rule",1219942905).cljs$core$IFn$_invoke$arity$1(left);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})(),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"by-rule","by-rule",1219942905).cljs$core$IFn$_invoke$arity$1(right);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})())], null);
});
org.kp.kpmc.companion_rules.merge_prefetch_summary = (function org$kp$kpmc$companion_rules$merge_prefetch_summary(summary,prefetch_data){
if(cljs.core.not.call(null,prefetch_data)){
return summary;
} else {
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"ok","ok",967785236),(function (){var and__5140__auto__ = (!(new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(summary) === false));
if(and__5140__auto__){
return new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(prefetch_data);
} else {
return and__5140__auto__;
}
})(),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417),((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417).cljs$core$IFn$_invoke$arity$1(summary);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()),new cljs.core.Keyword(null,"row-count","row-count",1060167988),((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(summary);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})() + (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()),new cljs.core.Keyword(null,"spec-count","spec-count",640286431),cljs.core.max.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"spec-count","spec-count",640286431).cljs$core$IFn$_invoke$arity$1(summary);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"spec-count","spec-count",640286431).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})()),new cljs.core.Keyword(null,"error","error",-978969032),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(summary);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(prefetch_data);
}
})()], null);
}
});
org.kp.kpmc.companion_rules.merge_comparison_summary = (function org$kp$kpmc$companion_rules$merge_comparison_summary(summary,comparison){
if((comparison == null)){
return summary;
} else {
if((summary == null)){
return comparison;
} else {
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"legacy-count","legacy-count",1976464452),(new cljs.core.Keyword(null,"legacy-count","legacy-count",1976464452).cljs$core$IFn$_invoke$arity$1(summary) + new cljs.core.Keyword(null,"legacy-count","legacy-count",1976464452).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"single-count","single-count",-1765620100),(new cljs.core.Keyword(null,"single-count","single-count",-1765620100).cljs$core$IFn$_invoke$arity$1(summary) + new cljs.core.Keyword(null,"single-count","single-count",-1765620100).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"compared-count","compared-count",-2011072646),(new cljs.core.Keyword(null,"compared-count","compared-count",-2011072646).cljs$core$IFn$_invoke$arity$1(summary) + new cljs.core.Keyword(null,"compared-count","compared-count",-2011072646).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"length-delta","length-delta",-1516594855),(new cljs.core.Keyword(null,"length-delta","length-delta",-1516594855).cljs$core$IFn$_invoke$arity$1(summary) + new cljs.core.Keyword(null,"length-delta","length-delta",-1516594855).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"mismatch-count","mismatch-count",1959684515),(new cljs.core.Keyword(null,"mismatch-count","mismatch-count",1959684515).cljs$core$IFn$_invoke$arity$1(summary) + new cljs.core.Keyword(null,"mismatch-count","mismatch-count",1959684515).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"mismatch-count-by-segment-ref","mismatch-count-by-segment-ref",-183732194),cljs.core.merge_with.call(null,cljs.core._PLUS_,new cljs.core.Keyword(null,"mismatch-count-by-segment-ref","mismatch-count-by-segment-ref",-183732194).cljs$core$IFn$_invoke$arity$1(summary),new cljs.core.Keyword(null,"mismatch-count-by-segment-ref","mismatch-count-by-segment-ref",-183732194).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"mismatch-count-by-rule-id","mismatch-count-by-rule-id",412132757),cljs.core.merge_with.call(null,cljs.core._PLUS_,new cljs.core.Keyword(null,"mismatch-count-by-rule-id","mismatch-count-by-rule-id",412132757).cljs$core$IFn$_invoke$arity$1(summary),new cljs.core.Keyword(null,"mismatch-count-by-rule-id","mismatch-count-by-rule-id",412132757).cljs$core$IFn$_invoke$arity$1(comparison)),new cljs.core.Keyword(null,"mismatch-samples","mismatch-samples",-84816597),cljs.core.vec.call(null,cljs.core.take.call(null,(25),cljs.core.concat.call(null,new cljs.core.Keyword(null,"mismatch-samples","mismatch-samples",-84816597).cljs$core$IFn$_invoke$arity$1(summary),new cljs.core.Keyword(null,"mismatch-samples","mismatch-samples",-84816597).cljs$core$IFn$_invoke$arity$1(comparison))))], null);

}
}
});
org.kp.kpmc.companion_rules.run_rule_harness_isa_streaming = (function org$kp$kpmc$companion_rules$run_rule_harness_isa_streaming(companion_csv,edi_file,opts){
if((((!(new cljs.core.Keyword(null,"include-parsed?","include-parsed?",-260661768).cljs$core$IFn$_invoke$arity$1(opts) === false))) || ((!(new cljs.core.Keyword(null,"include-enriched?","include-enriched?",-1272866002).cljs$core$IFn$_invoke$arity$1(opts) === false))))){
throw cljs.core.ex_info.call(null,"Streaming validation requires includeParsed=false and includeEnriched=false",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"streaming-tree-output-not-supported","streaming-tree-output-not-supported",-1697728048)], null));
} else {
}

var map__2359 = org.kp.kpmc.companion_rules.parse_companion_csv__GT_rules.call(null,companion_csv);
var map__2359__$1 = cljs.core.__destructure_map.call(null,map__2359);
var rules = cljs.core.get.call(null,map__2359__$1,new cljs.core.Keyword(null,"rules","rules",1198912366));
var model = cljs.core.get.call(null,map__2359__$1,new cljs.core.Keyword(null,"model","model",331153215));
var db_enabled_QMARK_ = ((new cljs.core.Keyword(null,"db-validation?","db-validation?",2032147196).cljs$core$IFn$_invoke$arity$1(opts) === true) || (((cljs.core._EQ_.call(null,"true",clojure.string.lower_case.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto____$1 = org.kp.kpmc.companion_rules.env_get.call(null,"DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "";
}
})()))))) || (cljs.core._EQ_.call(null,"1",(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto____$2 = org.kp.kpmc.companion_rules.env_get.call(null,"DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return "";
}
})())))))));
var lookup_spec_file = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "save/companion-db-lookups.edn";
}
})();
var lookup_requested_QMARK_ = ((db_enabled_QMARK_) || (cljs.core.contains_QMARK_.call(null,opts,new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480))));
var lookup_doc = ((lookup_requested_QMARK_)?org.kp.kpmc.companion_rules.load_lookup_specs.call(null,lookup_spec_file):null);
var lookup_index = (cljs.core.truth_(lookup_doc)?org.kp.kpmc.companion_rules.build_lookup_index.call(null,lookup_doc):null);
var db_config = ((db_enabled_QMARK_)?org.kp.kpmc.companion_rules.resolve_db_config.call(null,opts):null);
var single_query_QMARK_ = new cljs.core.Keyword(null,"single-query-db-validation?","single-query-db-validation?",-963174521).cljs$core$IFn$_invoke$arity$1(opts) === true;
var compare_QMARK_ = new cljs.core.Keyword(null,"compare-single-query-vs-legacy?","compare-single-query-vs-legacy?",-1756464179).cljs$core$IFn$_invoke$arity$1(opts) === true;
var legacy_executor = ((db_enabled_QMARK_)?org.kp.kpmc.companion_rules.make_oracle_lookup_executor.call(null,opts):null);
var run_id = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"run-id","run-id",-1745267908).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"runId","runId",505587730).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.random_uuid.call(null)));
}
}
})();
var started_ms = org.kp.kpmc.companion_rules.now_ms.call(null);
var started_at = org.kp.kpmc.companion_rules.now_iso.call(null);
var progress_opts = cljs.core.assoc.call(null,opts,new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id);
var initial = new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"stats","stats",-85643011),new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"total","total",1916810418),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"attempted","attempted",1101657210),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"skipped","skipped",-1144887090),(0)], null),new cljs.core.Keyword(null,"by-rule","by-rule",1219942905),cljs.core.PersistentArrayMap.EMPTY], null),new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),cljs.core.PersistentVector.EMPTY,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),cljs.core.PersistentVector.EMPTY,new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),(0),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),(0),new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721),null,new cljs.core.Keyword(null,"comparison","comparison",-986182462),null], null);
var _ = org.kp.kpmc.companion_rules.init_progress_file_BANG_.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})());
var result = org.kp.kpmc.io_node.reduce_isa_file.call(null,edi_file,cljs.core.select_keys.call(null,opts,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"read-buffer-size","read-buffer-size",-876215313)], null)),(function (acc,p__2360){
var map__2361 = p__2360;
var map__2361__$1 = cljs.core.__destructure_map.call(null,map__2361);
var isa_index = cljs.core.get.call(null,map__2361__$1,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564));
var segment_count = cljs.core.get.call(null,map__2361__$1,new cljs.core.Keyword(null,"segment-count","segment-count",681013183));
var text = cljs.core.get.call(null,map__2361__$1,new cljs.core.Keyword(null,"text","text",-1790561697));
org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,progress_opts,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"event-type","event-type",319722813),"isa-started",new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isas","processed-isas",20442336),(isa_index - (1)),new cljs.core.Keyword(null,"total-isas","total-isas",1768193795),null,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms)], null));

org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"streaming:isa-detected",new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isa-count","processed-isa-count",-1708579594),(isa_index - (1)),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),segment_count,new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(acc)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(acc))], null));

var parse_tree = org.kp.kpmc.parser.parse_x12_text.call(null,text,cljs.core.select_keys.call(null,opts,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409)], null)));
var ___$1 = org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,progress_opts,new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"event-type","event-type",319722813),"isa-parsed",new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isas","processed-isas",20442336),(isa_index - (1)),new cljs.core.Keyword(null,"total-isas","total-isas",1768193795),null,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),segment_count,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms)], null));
var subscriber_ssns = org.kp.kpmc.companion_rules.extract_subscriber_ssns_from_parse_tree.call(null,parse_tree);
var prefetch_data = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
var and__5140__auto____$2 = db_config;
if(cljs.core.truth_(and__5140__auto____$2)){
var and__5140__auto____$3 = new cljs.core.Keyword(null,"valid?","valid?",-212412379).cljs$core$IFn$_invoke$arity$1(db_config);
if(cljs.core.truth_(and__5140__auto____$3)){
return lookup_doc;
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?org.kp.kpmc.companion_rules.load_subscriber_prefetch_data.call(null,db_config,parse_tree,lookup_doc):null);
var single_executor = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
return prefetch_data;
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?org.kp.kpmc.companion_rules.make_single_query_subscriber_executor.call(null,opts,prefetch_data):null);
var effective_executor = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
if(db_enabled_QMARK_){
if(cljs.core.truth_(single_executor)){
return (function (p__2362){
var map__2363 = p__2362;
var map__2363__$1 = cljs.core.__destructure_map.call(null,map__2363);
var input = map__2363__$1;
var db_context = cljs.core.get.call(null,map__2363__$1,new cljs.core.Keyword(null,"db-context","db-context",371097239));
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context))){
return single_executor.call(null,input);
} else {
return legacy_executor.call(null,input);
}
});
} else {
return legacy_executor;
}
} else {
return null;
}
}
})();
var validation = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170),new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582),new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875),new cljs.core.Keyword(null,"on-progress","on-progress",1196110410),new cljs.core.Keyword(null,"db-validation-enabled?","db-validation-enabled?",19180651),new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),new cljs.core.Keyword(null,"initialize-progress-file?","initialize-progress-file?",223942229),new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528),new cljs.core.Keyword(null,"heartbeat-every-db-attempts","heartbeat-every-db-attempts",45700953),new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409)],[(new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(acc) + cljs.core.count.call(null,subscriber_ssns)),lookup_index,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"on-progress","on-progress",1196110410).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"onProgress","onProgress",987195821).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),db_enabled_QMARK_,subscriber_ssns,cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})()),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),false,new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(acc),new cljs.core.Keyword(null,"heartbeat-every-db-attempts","heartbeat-every-db-attempts",45700953).cljs$core$IFn$_invoke$arity$1(opts),effective_executor,isa_index,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460).cljs$core$IFn$_invoke$arity$1(opts),run_id,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts)]));
var annotated_tree = new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771).cljs$core$IFn$_invoke$arity$1(validation);
var findings = org.kp.kpmc.companion_rules.collect_invalid_findings.call(null,annotated_tree,isa_index);
var statuses = new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(validation);
var subscriber_count = (new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(acc) + cljs.core.count.call(null,statuses));
var comparison = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
var and__5140__auto____$2 = compare_QMARK_;
if(and__5140__auto____$2){
var and__5140__auto____$3 = legacy_executor;
if(cljs.core.truth_(and__5140__auto____$3)){
return effective_executor;
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?(function (){var legacy_validation = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582),new cljs.core.Keyword(null,"db-validation-enabled?","db-validation-enabled?",19180651),new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804),new cljs.core.Keyword(null,"initialize-progress-file?","initialize-progress-file?",223942229),new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528),new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"run-id","run-id",-1745267908)],[lookup_index,db_enabled_QMARK_,subscriber_ssns,false,new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(acc),legacy_executor,isa_index,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460).cljs$core$IFn$_invoke$arity$1(opts),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(run_id)+"-legacy")]));
return org.kp.kpmc.companion_rules.compare_lookup_outcomes.call(null,org.kp.kpmc.companion_rules.collect_lookup_outcomes.call(null,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771).cljs$core$IFn$_invoke$arity$1(legacy_validation)),org.kp.kpmc.companion_rules.collect_lookup_outcomes.call(null,annotated_tree));
})():null);
var next_acc = cljs.core.update.call(null,cljs.core.update.call(null,cljs.core.assoc.call(null,cljs.core.update.call(null,cljs.core.update.call(null,cljs.core.update.call(null,acc,new cljs.core.Keyword(null,"stats","stats",-85643011),org.kp.kpmc.companion_rules.merge_validation_stats,new cljs.core.Keyword(null,"stats","stats",-85643011).cljs$core$IFn$_invoke$arity$1(validation)),new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),cljs.core.into,statuses),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),cljs.core.into,findings),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),subscriber_count,new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),isa_index),new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721),org.kp.kpmc.companion_rules.merge_prefetch_summary,prefetch_data),new cljs.core.Keyword(null,"comparison","comparison",-986182462),org.kp.kpmc.companion_rules.merge_comparison_summary,comparison);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"streaming:compact-findings-extracted",new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isa-count","processed-isa-count",-1708579594),isa_index,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),segment_count,new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(next_acc)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(next_acc)),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})())], null));

org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,progress_opts,new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"event-type","event-type",319722813),"isa-completed",new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isas","processed-isas",20442336),isa_index,new cljs.core.Keyword(null,"total-isas","total-isas",1768193795),null,new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),cljs.core.count.call(null,statuses),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),segment_count,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms)], null));

org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"streaming:isa-references-ready-for-release",new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isa-count","processed-isa-count",-1708579594),isa_index,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),segment_count,new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(next_acc)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(next_acc))], null));

return next_acc;
}),initial);
var stats = new cljs.core.Keyword(null,"stats","stats",-85643011).cljs$core$IFn$_invoke$arity$1(result);
var statuses = new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(result);
var elapsed_ms = (org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms);
var report = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),new cljs.core.Keyword(null,"lookup-summary","lookup-summary",1485614183),new cljs.core.Keyword(null,"db-validation-enabled","db-validation-enabled",-362301625),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),new cljs.core.Keyword(null,"single-query-prefetch-summary","single-query-prefetch-summary",836522667),new cljs.core.Keyword(null,"legend-count","legend-count",-564620371),new cljs.core.Keyword(null,"loop-count","loop-count",792041806),new cljs.core.Keyword(null,"single-query-db-validation-enabled","single-query-db-validation-enabled",-1024383058),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),new cljs.core.Keyword(null,"lookup-spec-count","lookup-spec-count",-1820151341),new cljs.core.Keyword(null,"single-query-legacy-compare","single-query-legacy-compare",237231060),new cljs.core.Keyword(null,"db-env-name","db-env-name",-1250740875),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989),new cljs.core.Keyword(null,"lookup-enabled-spec-count","lookup-enabled-spec-count",-152316203),new cljs.core.Keyword(null,"rule-count","rule-count",-1633498761),new cljs.core.Keyword(null,"context-keys","context-keys",-844838600),new cljs.core.Keyword(null,"element-row-count","element-row-count",1398185528),new cljs.core.Keyword(null,"rule-kind-counts","rule-kind-counts",1300665),new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),new cljs.core.Keyword(null,"validation","validation",-2141396518),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"streaming","streaming",774370687)],[statuses,new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(stats),db_enabled_QMARK_,started_at,lookup_spec_file,new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721).cljs$core$IFn$_invoke$arity$1(result),cljs.core.count.call(null,new cljs.core.Keyword(null,"legend","legend",-1027192245).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.count.call(null,new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.boolean$.call(null,(function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
return new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721).cljs$core$IFn$_invoke$arity$1(result);
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})()),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(result),cljs.core.count.call(null,new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc)),(function (){var temp__5825__auto__ = new cljs.core.Keyword(null,"comparison","comparison",-986182462).cljs$core$IFn$_invoke$arity$1(result);
if(cljs.core.truth_(temp__5825__auto__)){
var comparison = temp__5825__auto__;
return cljs.core.assoc.call(null,comparison,new cljs.core.Keyword(null,"enabled","enabled",1195909756),true,new cljs.core.Keyword(null,"performed","performed",1002519565),true);
} else {
return null;
}
})(),new cljs.core.Keyword(null,"env-name","env-name",1998966009).cljs$core$IFn$_invoke$arity$1(db_config),org.kp.kpmc.companion_rules.build_subscriber_progress_summary.call(null,statuses),cljs.core.count.call(null,cljs.core.filter.call(null,new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc))),cljs.core.count.call(null,rules),null,cljs.core.count.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.frequencies.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"kind","kind",-717265803),rules)),elapsed_ms,stats,run_id,true]);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"streaming:run-result-constructed",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"processed-isa-count","processed-isa-count",-1708579594),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(result)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,statuses)], null));

return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"report","report",1394055010),report,new cljs.core.Keyword(null,"rules","rules",1198912366),rules,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"parsed-tree","parsed-tree",1040023394),null,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771),null], null);
});
org.kp.kpmc.companion_rules.run_rule_harness_streaming = (function org$kp$kpmc$companion_rules$run_rule_harness_streaming(companion_csv,edi_file,opts){
if((((!(new cljs.core.Keyword(null,"include-parsed?","include-parsed?",-260661768).cljs$core$IFn$_invoke$arity$1(opts) === false))) || ((!(new cljs.core.Keyword(null,"include-enriched?","include-enriched?",-1272866002).cljs$core$IFn$_invoke$arity$1(opts) === false))))){
throw cljs.core.ex_info.call(null,"Streaming validation requires includeParsed=false and includeEnriched=false",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"streaming-tree-output-not-supported","streaming-tree-output-not-supported",-1697728048)], null));
} else {
}

var map__2366 = org.kp.kpmc.companion_rules.parse_companion_csv__GT_rules.call(null,companion_csv);
var map__2366__$1 = cljs.core.__destructure_map.call(null,map__2366);
var rules = cljs.core.get.call(null,map__2366__$1,new cljs.core.Keyword(null,"rules","rules",1198912366));
var model = cljs.core.get.call(null,map__2366__$1,new cljs.core.Keyword(null,"model","model",331153215));
var collect_findings_QMARK_ = (!(new cljs.core.Keyword(null,"collect-invalid-findings?","collect-invalid-findings?",1737968512).cljs$core$IFn$_invoke$arity$1(opts) === false));
var collect_subscriber_statuses_QMARK_ = (!(new cljs.core.Keyword(null,"collect-subscriber-statuses?","collect-subscriber-statuses?",773411372).cljs$core$IFn$_invoke$arity$1(opts) === false));
var subscriber_batch_size = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-batch-size","subscriber-batch-size",417020345).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"subscriberBatchSize","subscriberBatchSize",-1881084201).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return (1);
}
}
})();
var _ = ((((typeof subscriber_batch_size === 'number') && (((Number.isInteger(subscriber_batch_size)) && ((subscriber_batch_size > (0)))))))?null:(function(){throw cljs.core.ex_info.call(null,"subscriberBatchSize must be a positive integer",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-subscriber-batch-size","invalid-subscriber-batch-size",-1707682211),new cljs.core.Keyword(null,"subscriber-batch-size","subscriber-batch-size",417020345),subscriber_batch_size], null))})());
var on_finding_batch = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"on-finding-batch","on-finding-batch",-1341968258).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"onFindingBatch","onFindingBatch",990331618).cljs$core$IFn$_invoke$arity$1(opts);
}
})();
var finding_output_file = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"finding-output-file","finding-output-file",-1281220345).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"findingOutputFile","findingOutputFile",-780700416).cljs$core$IFn$_invoke$arity$1(opts);
}
})();
var finding_batch_size = cljs.core.max.call(null,(1),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"finding-batch-size","finding-batch-size",569358789).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"findingBatchSize","findingBatchSize",-977714346).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return (250);
}
}
})());
var ___$1 = (((((!(collect_findings_QMARK_))) && ((((on_finding_batch == null)) && (org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,finding_output_file))))))?(function(){throw cljs.core.ex_info.call(null,"Streaming findings require collection, a callback, or an NDJSON file",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-finding-destination","missing-finding-destination",67260253)], null))})():null);
var ___$2 = ((org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,finding_output_file))?null:require("fs").writeFileSync(finding_output_file,"","utf8"));
var deliver_findings_BANG_ = (function (findings){
var seq__2367 = cljs.core.seq.call(null,cljs.core.partition_all.call(null,finding_batch_size,findings));
var chunk__2368 = null;
var count__2369 = (0);
var i__2370 = (0);
while(true){
if((i__2370 < count__2369)){
var batch = cljs.core._nth.call(null,chunk__2368,i__2370);
var batch_2376__$1 = cljs.core.vec.call(null,batch);
if(cljs.core.truth_(on_finding_batch)){
on_finding_batch.call(null,cljs.core.clj__GT_js.call(null,batch_2376__$1));
} else {
}

if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,finding_output_file)){
} else {
require("fs").appendFileSync(finding_output_file,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"\n",cljs.core.map.call(null,((function (seq__2367,chunk__2368,count__2369,i__2370,batch_2376__$1,batch,map__2366,map__2366__$1,rules,model,collect_findings_QMARK_,collect_subscriber_statuses_QMARK_,subscriber_batch_size,_,on_finding_batch,finding_output_file,finding_batch_size,___$1,___$2){
return (function (p1__2364_SHARP_){
return JSON.stringify(cljs.core.clj__GT_js.call(null,p1__2364_SHARP_));
});})(seq__2367,chunk__2368,count__2369,i__2370,batch_2376__$1,batch,map__2366,map__2366__$1,rules,model,collect_findings_QMARK_,collect_subscriber_statuses_QMARK_,subscriber_batch_size,_,on_finding_batch,finding_output_file,finding_batch_size,___$1,___$2))
,batch_2376__$1)))+"\n"),"utf8");
}


var G__2377 = seq__2367;
var G__2378 = chunk__2368;
var G__2379 = count__2369;
var G__2380 = (i__2370 + (1));
seq__2367 = G__2377;
chunk__2368 = G__2378;
count__2369 = G__2379;
i__2370 = G__2380;
continue;
} else {
var temp__5825__auto__ = cljs.core.seq.call(null,seq__2367);
if(temp__5825__auto__){
var seq__2367__$1 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__2367__$1)){
var c__5673__auto__ = cljs.core.chunk_first.call(null,seq__2367__$1);
var G__2381 = cljs.core.chunk_rest.call(null,seq__2367__$1);
var G__2382 = c__5673__auto__;
var G__2383 = cljs.core.count.call(null,c__5673__auto__);
var G__2384 = (0);
seq__2367 = G__2381;
chunk__2368 = G__2382;
count__2369 = G__2383;
i__2370 = G__2384;
continue;
} else {
var batch = cljs.core.first.call(null,seq__2367__$1);
var batch_2385__$1 = cljs.core.vec.call(null,batch);
if(cljs.core.truth_(on_finding_batch)){
on_finding_batch.call(null,cljs.core.clj__GT_js.call(null,batch_2385__$1));
} else {
}

if(org.kp.kpmc.companion_rules.blankish_QMARK_.call(null,finding_output_file)){
} else {
require("fs").appendFileSync(finding_output_file,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"\n",cljs.core.map.call(null,((function (seq__2367,chunk__2368,count__2369,i__2370,batch_2385__$1,batch,seq__2367__$1,temp__5825__auto__,map__2366,map__2366__$1,rules,model,collect_findings_QMARK_,collect_subscriber_statuses_QMARK_,subscriber_batch_size,_,on_finding_batch,finding_output_file,finding_batch_size,___$1,___$2){
return (function (p1__2364_SHARP_){
return JSON.stringify(cljs.core.clj__GT_js.call(null,p1__2364_SHARP_));
});})(seq__2367,chunk__2368,count__2369,i__2370,batch_2385__$1,batch,seq__2367__$1,temp__5825__auto__,map__2366,map__2366__$1,rules,model,collect_findings_QMARK_,collect_subscriber_statuses_QMARK_,subscriber_batch_size,_,on_finding_batch,finding_output_file,finding_batch_size,___$1,___$2))
,batch_2385__$1)))+"\n"),"utf8");
}


var G__2386 = cljs.core.next.call(null,seq__2367__$1);
var G__2387 = null;
var G__2388 = (0);
var G__2389 = (0);
seq__2367 = G__2386;
chunk__2368 = G__2387;
count__2369 = G__2388;
i__2370 = G__2389;
continue;
}
} else {
return null;
}
}
break;
}
});
var db_enabled_QMARK_ = ((new cljs.core.Keyword(null,"db-validation?","db-validation?",2032147196).cljs$core$IFn$_invoke$arity$1(opts) === true) || (((cljs.core._EQ_.call(null,"true",clojure.string.lower_case.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto____$1 = org.kp.kpmc.companion_rules.env_get.call(null,"DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "";
}
})()))))) || (cljs.core._EQ_.call(null,"1",(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto____$2 = org.kp.kpmc.companion_rules.env_get.call(null,"DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return "";
}
})())))))));
var lookup_spec_file = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "save/companion-db-lookups.edn";
}
})();
var lookup_requested_QMARK_ = ((db_enabled_QMARK_) || (cljs.core.contains_QMARK_.call(null,opts,new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480))));
var lookup_doc = ((lookup_requested_QMARK_)?org.kp.kpmc.companion_rules.load_lookup_specs.call(null,lookup_spec_file):null);
var lookup_index = (cljs.core.truth_(lookup_doc)?org.kp.kpmc.companion_rules.build_lookup_index.call(null,lookup_doc):null);
var db_config = ((db_enabled_QMARK_)?org.kp.kpmc.companion_rules.resolve_db_config.call(null,opts):null);
var single_query_QMARK_ = new cljs.core.Keyword(null,"single-query-db-validation?","single-query-db-validation?",-963174521).cljs$core$IFn$_invoke$arity$1(opts) === true;
var compare_QMARK_ = new cljs.core.Keyword(null,"compare-single-query-vs-legacy?","compare-single-query-vs-legacy?",-1756464179).cljs$core$IFn$_invoke$arity$1(opts) === true;
var legacy_executor = ((db_enabled_QMARK_)?org.kp.kpmc.companion_rules.make_oracle_lookup_executor.call(null,opts):null);
var ins_parser_instance = new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282).cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.parser.create_parsers.call(null));
var run_id = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"run-id","run-id",-1745267908).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"runId","runId",505587730).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.random_uuid.call(null)));
}
}
})();
var started_ms = org.kp.kpmc.companion_rules.now_ms.call(null);
var started_at = org.kp.kpmc.companion_rules.now_iso.call(null);
var total_subscribers = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"totalSubscribers","totalSubscribers",-1502855776).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return org.kp.kpmc.io_node.reduce_ins_file.call(null,edi_file,cljs.core.select_keys.call(null,opts,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"read-buffer-size","read-buffer-size",-876215313)], null)),(function (total,unit){
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"type","type",1174270348).cljs$core$IFn$_invoke$arity$1(unit))){
return (total + (1));
} else {
return total;
}
}),(0));
}
}
})();
var progress_opts = cljs.core.assoc.call(null,opts,new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id);
var validation_opts = (function (state,isa_index,executor,subscriber_ssns,prefetch_data){
return cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"isa-context-already-entered?","isa-context-already-entered?",531867840),new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170),new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582),new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"started-ms","started-ms",1106122505),new cljs.core.Keyword(null,"collect-invalid-findings-during-validation?","collect-invalid-findings-during-validation?",-2114132055),new cljs.core.Keyword(null,"on-progress","on-progress",1196110410),new cljs.core.Keyword(null,"db-validation-enabled?","db-validation-enabled?",19180651),new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),new cljs.core.Keyword(null,"initial-context","initial-context",-32910095),new cljs.core.Keyword(null,"initialize-progress-file?","initialize-progress-file?",223942229),new cljs.core.Keyword(null,"subscriber-index-offset","subscriber-index-offset",-1355159528),new cljs.core.Keyword(null,"heartbeat-every-db-attempts","heartbeat-every-db-attempts",45700953),new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"initial-commercial-refs","initial-commercial-refs",-1051283619),new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409),new cljs.core.Keyword(null,"annotate-tree?","annotate-tree?",1971190655)],[true,total_subscribers,lookup_index,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),started_at,started_ms,true,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"on-progress","on-progress",1196110410).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"onProgress","onProgress",987195821).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),db_enabled_QMARK_,subscriber_ssns,cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})()),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"commercial-context","commercial-context",1070384265).cljs$core$IFn$_invoke$arity$1(state),false,new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(state),new cljs.core.Keyword(null,"heartbeat-every-db-attempts","heartbeat-every-db-attempts",45700953).cljs$core$IFn$_invoke$arity$1(opts),executor,isa_index,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460).cljs$core$IFn$_invoke$arity$1(opts),run_id,new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454).cljs$core$IFn$_invoke$arity$1(state),new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),false]);
});
var merge_validation = (function (state,validation,findings){
var statuses = new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(validation);
deliver_findings_BANG_.call(null,findings);

var G__2371 = cljs.core.update.call(null,cljs.core.update.call(null,state,new cljs.core.Keyword(null,"stats","stats",-85643011),org.kp.kpmc.companion_rules.merge_validation_stats,new cljs.core.Keyword(null,"stats","stats",-85643011).cljs$core$IFn$_invoke$arity$1(validation)),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989),org.kp.kpmc.companion_rules.merge_subscriber_progress_summary,statuses);
var G__2371__$1 = ((collect_subscriber_statuses_QMARK_)?cljs.core.update.call(null,G__2371,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),cljs.core.into,statuses):G__2371);
if(collect_findings_QMARK_){
return cljs.core.update.call(null,G__2371__$1,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),cljs.core.into,findings);
} else {
return G__2371__$1;
}
});
var validate_context = (function (state){
if(cljs.core.empty_QMARK_.call(null,new cljs.core.Keyword(null,"pending-context","pending-context",275093729).cljs$core$IFn$_invoke$arity$1(state))){
return state;
} else {
var isa_index = new cljs.core.Keyword(null,"current-isa-index","current-isa-index",-214953552).cljs$core$IFn$_invoke$arity$1(state);
var body_segments = cljs.core.remove.call(null,(function (segment){
return cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 6, ["IEA",null,"GE",null,"SE",null,"ISA",null,"GS",null,"ST",null], null), null),cljs.core.first.call(null,clojure.string.split.call(null,segment,/\*/,(2))));
}),new cljs.core.Keyword(null,"pending-context","pending-context",275093729).cljs$core$IFn$_invoke$arity$1(state));
var parse_tree = new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"x12file","x12file",-1619755107),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"functional_group","functional_group",1799340978),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"transaction_set","transaction_set",-906308203),cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_body","trans_body",-907422531)], null),cljs.core.map.call(null,(function (segment){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"raw_segment","raw_segment",-482193833),segment], null);
}),body_segments))], null)], null)], null);
var executor = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
if(db_enabled_QMARK_){
return legacy_executor;
} else {
return null;
}
}
})();
var validation = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.assoc.call(null,validation_opts.call(null,state,isa_index,executor,cljs.core.PersistentVector.EMPTY,null),new cljs.core.Keyword(null,"finding-trail","finding-trail",-1427155948),new cljs.core.PersistentVector(null, 4, 5, cljs.core.PersistentVector.EMPTY_NODE, ["x12file","functional_group","transaction_set","trans_body"], null)));
var findings = new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(validation);
return cljs.core.assoc.call(null,merge_validation.call(null,state,validation,findings),new cljs.core.Keyword(null,"commercial-context","commercial-context",1070384265),new cljs.core.Keyword(null,"context","context",-830191113).cljs$core$IFn$_invoke$arity$1(validation),new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454),cljs.core.get_in.call(null,validation,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"db-state","db-state",1624009049),new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454)], null)),new cljs.core.Keyword(null,"pending-context","pending-context",275093729),cljs.core.PersistentVector.EMPTY);
}
});
var validate_subscriber_batch = (function (state,units){
var map__2372 = cljs.core.first.call(null,units);
var map__2372__$1 = cljs.core.__destructure_map.call(null,map__2372);
var isa_index = cljs.core.get.call(null,map__2372__$1,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564));
var transaction_index = cljs.core.get.call(null,map__2372__$1,new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549));
var subscriber_index = new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(cljs.core.last.call(null,units));
var segment_count = cljs.core.reduce.call(null,cljs.core._PLUS_,cljs.core.map.call(null,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),units));
var parse_tree = new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"x12file","x12file",-1619755107),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"functional_group","functional_group",1799340978),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"transaction_set","transaction_set",-906308203),cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_body","trans_body",-907422531)], null),cljs.core.map.call(null,(function (p1__2365_SHARP_){
return org.kp.kpmc.parser.parse_ins_text.call(null,new cljs.core.Keyword(null,"text","text",-1790561697).cljs$core$IFn$_invoke$arity$1(p1__2365_SHARP_),new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282),ins_parser_instance], null));
}),units))], null)], null)], null);
var subscriber_ssns = org.kp.kpmc.companion_rules.extract_subscriber_ssns_from_parse_tree.call(null,parse_tree);
var prefetch_data = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
var and__5140__auto____$2 = db_config;
if(cljs.core.truth_(and__5140__auto____$2)){
var and__5140__auto____$3 = new cljs.core.Keyword(null,"valid?","valid?",-212412379).cljs$core$IFn$_invoke$arity$1(db_config);
if(cljs.core.truth_(and__5140__auto____$3)){
return lookup_doc;
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?org.kp.kpmc.companion_rules.load_subscriber_prefetch_data.call(null,db_config,parse_tree,lookup_doc):null);
var single_executor = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
return prefetch_data;
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?org.kp.kpmc.companion_rules.make_single_query_subscriber_executor.call(null,opts,prefetch_data):null);
var effective_executor = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
if(db_enabled_QMARK_){
if(cljs.core.truth_(single_executor)){
return (function (p__2373){
var map__2374 = p__2373;
var map__2374__$1 = cljs.core.__destructure_map.call(null,map__2374);
var input = map__2374__$1;
var db_context = cljs.core.get.call(null,map__2374__$1,new cljs.core.Keyword(null,"db-context","db-context",371097239));
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context))){
return single_executor.call(null,input);
} else {
return legacy_executor.call(null,input);
}
});
} else {
return legacy_executor;
}
} else {
return null;
}
}
})();
var validation = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.assoc.call(null,validation_opts.call(null,state,isa_index,effective_executor,subscriber_ssns,prefetch_data),new cljs.core.Keyword(null,"annotate-tree?","annotate-tree?",1971190655),compare_QMARK_,new cljs.core.Keyword(null,"finding-trail","finding-trail",-1427155948),new cljs.core.PersistentVector(null, 5, 5, cljs.core.PersistentVector.EMPTY_NODE, ["x12file","functional_group","transaction_set","trans_body","ins_subscriber"], null)));
var findings = new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(validation);
var comparison = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
var and__5140__auto____$2 = compare_QMARK_;
if(and__5140__auto____$2){
var and__5140__auto____$3 = legacy_executor;
if(cljs.core.truth_(and__5140__auto____$3)){
return effective_executor;
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?(function (){var legacy_validation = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.assoc.call(null,validation_opts.call(null,state,isa_index,legacy_executor,subscriber_ssns,null),new cljs.core.Keyword(null,"annotate-tree?","annotate-tree?",1971190655),true,new cljs.core.Keyword(null,"collect-invalid-findings-during-validation?","collect-invalid-findings-during-validation?",-2114132055),false,new cljs.core.Keyword(null,"on-progress","on-progress",1196110410),null,new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875),null));
return org.kp.kpmc.companion_rules.compare_lookup_outcomes.call(null,org.kp.kpmc.companion_rules.collect_lookup_outcomes.call(null,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771).cljs$core$IFn$_invoke$arity$1(legacy_validation)),org.kp.kpmc.companion_rules.collect_lookup_outcomes.call(null,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771).cljs$core$IFn$_invoke$arity$1(validation)));
})():null);
var next_state = cljs.core.update.call(null,cljs.core.update.call(null,cljs.core.update.call(null,merge_validation.call(null,state,validation,findings),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),cljs.core._PLUS_,cljs.core.count.call(null,units)),new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721),org.kp.kpmc.companion_rules.merge_prefetch_summary,prefetch_data),new cljs.core.Keyword(null,"comparison","comparison",-986182462),org.kp.kpmc.companion_rules.merge_comparison_summary,comparison);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"streaming:subscriber-batch-references-ready-for-release",cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),new cljs.core.Keyword(null,"subscriber-batch-count","subscriber-batch-count",26487687),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"segment-count","segment-count",681013183)],[cljs.core.count.call(null,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(next_state)),transaction_index,cljs.core.count.call(null,units),cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})()),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(next_state)),subscriber_index,isa_index,segment_count]));

return next_state;
});
var flush_subscriber_batch = (function (state){
if(cljs.core.empty_QMARK_.call(null,new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032).cljs$core$IFn$_invoke$arity$1(state))){
return state;
} else {
return cljs.core.assoc.call(null,validate_subscriber_batch.call(null,state,new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032).cljs$core$IFn$_invoke$arity$1(state)),new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032),cljs.core.PersistentVector.EMPTY);
}
});
var initial = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"pending-context","pending-context",275093729),new cljs.core.Keyword(null,"comparison","comparison",-986182462),new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721),new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032),new cljs.core.Keyword(null,"commercial-context","commercial-context",1070384265),new cljs.core.Keyword(null,"current-isa-index","current-isa-index",-214953552),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),new cljs.core.Keyword(null,"current-isa-segment-count","current-isa-segment-count",1920905492),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989),new cljs.core.Keyword(null,"stats","stats",-85643011),new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078)],[cljs.core.PersistentVector.EMPTY,null,cljs.core.PersistentVector.EMPTY,null,cljs.core.PersistentVector.EMPTY,cljs.core.PersistentArrayMap.EMPTY,null,(0),(0),(0),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"total","total",1916810418),(0),new cljs.core.Keyword(null,"completed-passed","completed-passed",-2095238559),(0),new cljs.core.Keyword(null,"completed-failed","completed-failed",1681326090),(0),new cljs.core.Keyword(null,"completed-partial","completed-partial",1321839227),(0)], null),new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"total","total",1916810418),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"attempted","attempted",1101657210),(0),new cljs.core.Keyword(null,"passed","passed",-28165278),(0),new cljs.core.Keyword(null,"failed","failed",-1397425762),(0),new cljs.core.Keyword(null,"skipped","skipped",-1144887090),(0)], null),new cljs.core.Keyword(null,"by-rule","by-rule",1219942905),cljs.core.PersistentArrayMap.EMPTY], null),cljs.core.PersistentArrayMap.EMPTY,cljs.core.PersistentVector.EMPTY]);
var ___$3 = org.kp.kpmc.companion_rules.init_progress_file_BANG_.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})());
var reduced = org.kp.kpmc.io_node.reduce_ins_file.call(null,edi_file,cljs.core.select_keys.call(null,opts,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"read-buffer-size","read-buffer-size",-876215313)], null)),(function (state,unit){
var G__2375 = new cljs.core.Keyword(null,"type","type",1174270348).cljs$core$IFn$_invoke$arity$1(unit);
var G__2375__$1 = (((G__2375 instanceof cljs.core.Keyword))?G__2375.fqn:null);
switch (G__2375__$1) {
case "subscriber":
var state__$1 = ((cljs.core.empty_QMARK_.call(null,new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032).cljs$core$IFn$_invoke$arity$1(state)))?validate_context.call(null,state):state);
var state__$2 = cljs.core.update.call(null,cljs.core.update.call(null,state__$1,new cljs.core.Keyword(null,"current-isa-segment-count","current-isa-segment-count",1920905492),cljs.core._PLUS_,new cljs.core.Keyword(null,"segment-count","segment-count",681013183).cljs$core$IFn$_invoke$arity$1(unit)),new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032),cljs.core.conj,unit);
if((cljs.core.count.call(null,new cljs.core.Keyword(null,"pending-subscribers","pending-subscribers",1616785032).cljs$core$IFn$_invoke$arity$1(state__$2)) >= subscriber_batch_size)){
return flush_subscriber_batch.call(null,state__$2);
} else {
return state__$2;
}

break;
case "context":
var state__$1 = flush_subscriber_batch.call(null,state);
var isa_index = new cljs.core.Keyword(null,"isa-index","isa-index",1189721564).cljs$core$IFn$_invoke$arity$1(unit);
var segment_id = new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(unit);
var state__$2 = ((cljs.core._EQ_.call(null,segment_id,"ISA"))?(function (){
org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,progress_opts,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"event-type","event-type",319722813),"isa-started",new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isas","processed-isas",20442336),(isa_index - (1)),new cljs.core.Keyword(null,"total-isas","total-isas",1768193795),null,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms)], null));

org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,progress_opts,new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"event-type","event-type",319722813),"isa-parsed",new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isas","processed-isas",20442336),(isa_index - (1)),new cljs.core.Keyword(null,"total-isas","total-isas",1768193795),null,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),null,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms)], null));

return cljs.core.assoc.call(null,state__$1,new cljs.core.Keyword(null,"current-isa-index","current-isa-index",-214953552),isa_index,new cljs.core.Keyword(null,"current-isa-segment-count","current-isa-segment-count",1920905492),(0),new cljs.core.Keyword(null,"isa-subscriber-start","isa-subscriber-start",405546977),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(state__$1),new cljs.core.Keyword(null,"commercial-context","commercial-context",1070384265),cljs.core.PersistentArrayMap.EMPTY,new cljs.core.Keyword(null,"commercial-refs","commercial-refs",508899454),cljs.core.PersistentArrayMap.EMPTY);
})()
:state__$1);
var state__$3 = cljs.core.update.call(null,cljs.core.update.call(null,state__$2,new cljs.core.Keyword(null,"pending-context","pending-context",275093729),cljs.core.conj,new cljs.core.Keyword(null,"segment","segment",-964921196).cljs$core$IFn$_invoke$arity$1(unit)),new cljs.core.Keyword(null,"current-isa-segment-count","current-isa-segment-count",1920905492),cljs.core.inc);
if(cljs.core._EQ_.call(null,segment_id,"IEA")){
var state__$4 = validate_context.call(null,state__$3);
var segment_total = new cljs.core.Keyword(null,"current-isa-segment-count","current-isa-segment-count",1920905492).cljs$core$IFn$_invoke$arity$1(state__$4);
org.kp.kpmc.companion_rules.emit_progress_BANG_.call(null,progress_opts,new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"event-type","event-type",319722813),"isa-completed",new cljs.core.Keyword(null,"run-id","run-id",-1745267908),run_id,new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"processed-isas","processed-isas",20442336),isa_index,new cljs.core.Keyword(null,"total-isas","total-isas",1768193795),null,new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),(new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(state__$4) - new cljs.core.Keyword(null,"isa-subscriber-start","isa-subscriber-start",405546977).cljs$core$IFn$_invoke$arity$1(state__$4)),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),segment_total,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),(org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms)], null));

return cljs.core.assoc.call(null,state__$4,new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),isa_index);
} else {
return state__$3;
}

break;
default:
return state;

}
}),initial);
var result = validate_context.call(null,flush_subscriber_batch.call(null,reduced));
var stats = new cljs.core.Keyword(null,"stats","stats",-85643011).cljs$core$IFn$_invoke$arity$1(result);
var statuses = new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(result);
var elapsed_ms = (org.kp.kpmc.companion_rules.now_ms.call(null) - started_ms);
var report = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),new cljs.core.Keyword(null,"lookup-summary","lookup-summary",1485614183),new cljs.core.Keyword(null,"finding-output-file","finding-output-file",-1281220345),new cljs.core.Keyword(null,"db-validation-enabled","db-validation-enabled",-362301625),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),new cljs.core.Keyword(null,"single-query-prefetch-summary","single-query-prefetch-summary",836522667),new cljs.core.Keyword(null,"invalid-findings-collected","invalid-findings-collected",-1313508147),new cljs.core.Keyword(null,"legend-count","legend-count",-564620371),new cljs.core.Keyword(null,"loop-count","loop-count",792041806),new cljs.core.Keyword(null,"single-query-db-validation-enabled","single-query-db-validation-enabled",-1024383058),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),new cljs.core.Keyword(null,"lookup-spec-count","lookup-spec-count",-1820151341),new cljs.core.Keyword(null,"single-query-legacy-compare","single-query-legacy-compare",237231060),new cljs.core.Keyword(null,"db-env-name","db-env-name",-1250740875),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989),new cljs.core.Keyword(null,"lookup-enabled-spec-count","lookup-enabled-spec-count",-152316203),new cljs.core.Keyword(null,"subscriber-bounded-streaming","subscriber-bounded-streaming",-1734550409),new cljs.core.Keyword(null,"rule-count","rule-count",-1633498761),new cljs.core.Keyword(null,"context-keys","context-keys",-844838600),new cljs.core.Keyword(null,"element-row-count","element-row-count",1398185528),new cljs.core.Keyword(null,"rule-kind-counts","rule-kind-counts",1300665),new cljs.core.Keyword(null,"subscriber-batch-size","subscriber-batch-size",417020345),new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),new cljs.core.Keyword(null,"validation","validation",-2141396518),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"subscriber-statuses-collected","subscriber-statuses-collected",-208840195),new cljs.core.Keyword(null,"streaming","streaming",774370687)],[statuses,new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(stats),finding_output_file,db_enabled_QMARK_,started_at,lookup_spec_file,new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721).cljs$core$IFn$_invoke$arity$1(result),collect_findings_QMARK_,cljs.core.count.call(null,new cljs.core.Keyword(null,"legend","legend",-1027192245).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.count.call(null,new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.boolean$.call(null,(function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_QMARK_;
if(and__5140__auto____$1){
return new cljs.core.Keyword(null,"prefetch-summary","prefetch-summary",-1345653721).cljs$core$IFn$_invoke$arity$1(result);
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})()),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(result),cljs.core.count.call(null,new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc)),(function (){var temp__5825__auto__ = new cljs.core.Keyword(null,"comparison","comparison",-986182462).cljs$core$IFn$_invoke$arity$1(result);
if(cljs.core.truth_(temp__5825__auto__)){
var comparison = temp__5825__auto__;
return cljs.core.assoc.call(null,comparison,new cljs.core.Keyword(null,"enabled","enabled",1195909756),true,new cljs.core.Keyword(null,"performed","performed",1002519565),true);
} else {
return null;
}
})(),new cljs.core.Keyword(null,"env-name","env-name",1998966009).cljs$core$IFn$_invoke$arity$1(db_config),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989).cljs$core$IFn$_invoke$arity$1(result),cljs.core.count.call(null,cljs.core.filter.call(null,new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc))),true,cljs.core.count.call(null,rules),null,cljs.core.count.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.frequencies.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"kind","kind",-717265803),rules)),subscriber_batch_size,elapsed_ms,stats,run_id,collect_subscriber_statuses_QMARK_,true]);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"streaming:run-result-constructed",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"processed-isa-count","processed-isa-count",-1708579594),new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(result)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,statuses)], null));

return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"report","report",1394055010),report,new cljs.core.Keyword(null,"rules","rules",1198912366),rules,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"parsed-tree","parsed-tree",1040023394),null,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771),null], null);
});
/**
 * Test harness: parse companion CSV -> compile rules -> parse an EDI file -> validate.
 *   Returns parsed tree, annotated tree, and summary focused on validation coverage.
 */
org.kp.kpmc.companion_rules.run_rule_harness = (function org$kp$kpmc$companion_rules$run_rule_harness(var_args){
var G__2392 = arguments.length;
switch (G__2392) {
case 2:
return org.kp.kpmc.companion_rules.run_rule_harness.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 3:
return org.kp.kpmc.companion_rules.run_rule_harness.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.run_rule_harness.cljs$core$IFn$_invoke$arity$2 = (function (companion_csv,edi_file){
return org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.companion_rules.run_rule_harness.cljs$core$IFn$_invoke$arity$3 = (function (companion_csv,edi_file,opts){
cljs.core.println.call(null,"[run-rule-harness]");

if(new cljs.core.Keyword(null,"streaming?","streaming?",-88445658).cljs$core$IFn$_invoke$arity$1(opts) === true){
return org.kp.kpmc.companion_rules.run_rule_harness_streaming.call(null,companion_csv,edi_file,opts);
} else {
var map__2393 = org.kp.kpmc.companion_rules.parse_companion_csv__GT_rules.call(null,companion_csv);
var map__2393__$1 = cljs.core.__destructure_map.call(null,map__2393);
var rules = cljs.core.get.call(null,map__2393__$1,new cljs.core.Keyword(null,"rules","rules",1198912366));
var model = cljs.core.get.call(null,map__2393__$1,new cljs.core.Keyword(null,"model","model",331153215));
var db_enabled_QMARK_ = ((new cljs.core.Keyword(null,"db-validation?","db-validation?",2032147196).cljs$core$IFn$_invoke$arity$1(opts) === true) || (((cljs.core._EQ_.call(null,"true",clojure.string.lower_case.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto____$1 = org.kp.kpmc.companion_rules.env_get.call(null,"DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "";
}
})()))))) || (cljs.core._EQ_.call(null,"1",(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto____$2 = org.kp.kpmc.companion_rules.env_get.call(null,"DB_VALIDATION");
if(cljs.core.truth_(or__5142__auto____$2)){
return or__5142__auto____$2;
} else {
return "";
}
})())))))));
var lookup_spec_file = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "save/companion-db-lookups.edn";
}
})();
var lookup_requested_QMARK_ = ((db_enabled_QMARK_) || (cljs.core.contains_QMARK_.call(null,opts,new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480))));
var lookup_doc = ((lookup_requested_QMARK_)?org.kp.kpmc.companion_rules.load_lookup_specs.call(null,lookup_spec_file):null);
var lookup_index = (cljs.core.truth_(lookup_doc)?org.kp.kpmc.companion_rules.build_lookup_index.call(null,lookup_doc):null);
var db_config = ((db_enabled_QMARK_)?org.kp.kpmc.companion_rules.resolve_db_config.call(null,opts):null);
var single_query_db_validation_QMARK_ = new cljs.core.Keyword(null,"single-query-db-validation?","single-query-db-validation?",-963174521).cljs$core$IFn$_invoke$arity$1(opts) === true;
var compare_single_query_vs_legacy_QMARK_ = new cljs.core.Keyword(null,"compare-single-query-vs-legacy?","compare-single-query-vs-legacy?",-1756464179).cljs$core$IFn$_invoke$arity$1(opts) === true;
var _ = org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"run-rule-harness:before-edi-read",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"file","file",-1269645878),edi_file], null));
var parse_tree = org.kp.kpmc.parser.parse_x12_full.call(null,edi_file,cljs.core.select_keys.call(null,opts,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409)], null)));
var ___$1 = org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"run-rule-harness:after-full-parse",null);
var subscriber_ssns = org.kp.kpmc.companion_rules.extract_subscriber_ssns_from_parse_tree.call(null,parse_tree);
var prefetch_data = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_db_validation_QMARK_;
if(and__5140__auto____$1){
var and__5140__auto____$2 = db_config;
if(cljs.core.truth_(and__5140__auto____$2)){
var and__5140__auto____$3 = new cljs.core.Keyword(null,"valid?","valid?",-212412379).cljs$core$IFn$_invoke$arity$1(db_config);
if(cljs.core.truth_(and__5140__auto____$3)){
return lookup_doc;
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?org.kp.kpmc.companion_rules.load_subscriber_prefetch_data.call(null,db_config,parse_tree,lookup_doc):null);
var ___$2 = org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"run-rule-harness:after-db-prefetch",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})())], null));
var legacy_executor = ((db_enabled_QMARK_)?org.kp.kpmc.companion_rules.make_oracle_lookup_executor.call(null,opts):null);
var single_executor = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_db_validation_QMARK_;
if(and__5140__auto____$1){
return prefetch_data;
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?org.kp.kpmc.companion_rules.make_single_query_subscriber_executor.call(null,opts,prefetch_data):null);
var legacy_only_executor = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
if(db_enabled_QMARK_){
return legacy_executor;
} else {
return null;
}
}
})();
var effective_lookup_executor = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
if(db_enabled_QMARK_){
if(cljs.core.truth_(single_executor)){
return (function (p__2395){
var map__2396 = p__2395;
var map__2396__$1 = cljs.core.__destructure_map.call(null,map__2396);
var in$ = map__2396__$1;
var db_context = cljs.core.get.call(null,map__2396__$1,new cljs.core.Keyword(null,"db-context","db-context",371097239));
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"scope","scope",-439358418).cljs$core$IFn$_invoke$arity$1(db_context))){
return single_executor.call(null,in$);
} else {
return legacy_executor.call(null,in$);
}
});
} else {
return legacy_executor;
}
} else {
return null;
}
}
})();
var map__2394 = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582),new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875),new cljs.core.Keyword(null,"on-progress","on-progress",1196110410),new cljs.core.Keyword(null,"structural-loop-resolver","structural-loop-resolver",-1220853782),new cljs.core.Keyword(null,"db-validation-enabled?","db-validation-enabled?",19180651),new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409)],[lookup_index,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"on-progress","on-progress",1196110410).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"onProgress","onProgress",987195821).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),new cljs.core.Keyword(null,"structural-loop-resolver","structural-loop-resolver",-1220853782).cljs$core$IFn$_invoke$arity$1(opts),db_enabled_QMARK_,subscriber_ssns,cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})()),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),effective_lookup_executor,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460).cljs$core$IFn$_invoke$arity$1(opts),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"run-id","run-id",-1745267908).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"runId","runId",505587730).cljs$core$IFn$_invoke$arity$1(opts);
}
})(),new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts)]));
var map__2394__$1 = cljs.core.__destructure_map.call(null,map__2394);
var db_state = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"db-state","db-state",1624009049));
var elapsed_ms = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978));
var run_id = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"run-id","run-id",-1745267908));
var stats = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"stats","stats",-85643011));
var subscriber_statuses = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110));
var started_at = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"started-at","started-at",1318767912));
var annotated_tree = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771));
var subscriber_progress_summary = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989));
var context = cljs.core.get.call(null,map__2394__$1,new cljs.core.Keyword(null,"context","context",-830191113));
var comparison = (cljs.core.truth_((function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_db_validation_QMARK_;
if(and__5140__auto____$1){
var and__5140__auto____$2 = compare_single_query_vs_legacy_QMARK_;
if(and__5140__auto____$2){
var and__5140__auto____$3 = legacy_only_executor;
if(cljs.core.truth_(and__5140__auto____$3)){
return effective_lookup_executor;
} else {
return and__5140__auto____$3;
}
} else {
return and__5140__auto____$2;
}
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())?(function (){var map__2397 = org.kp.kpmc.companion_rules.validate_edi_parse_tree.call(null,parse_tree,rules,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"lookup-index","lookup-index",-1886927582),lookup_index,new cljs.core.Keyword(null,"lookup-executor","lookup-executor",-158156549),legacy_only_executor,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460).cljs$core$IFn$_invoke$arity$1(opts),new cljs.core.Keyword(null,"db-validation-enabled?","db-validation-enabled?",19180651),db_enabled_QMARK_,new cljs.core.Keyword(null,"subscriber-ssns","subscriber-ssns",195777804),subscriber_ssns,new cljs.core.Keyword(null,"run-id","run-id",-1745267908),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"run-id","run-id",-1745267908).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = new cljs.core.Keyword(null,"runId","runId",505587730).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return "run";
}
}
})())+"-legacy")], null));
var map__2397__$1 = cljs.core.__destructure_map.call(null,map__2397);
var legacy_tree = cljs.core.get.call(null,map__2397__$1,new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771));
var legacy_outcomes = org.kp.kpmc.companion_rules.collect_lookup_outcomes.call(null,legacy_tree);
var single_outcomes = org.kp.kpmc.companion_rules.collect_lookup_outcomes.call(null,annotated_tree);
return org.kp.kpmc.companion_rules.compare_lookup_outcomes.call(null,legacy_outcomes,single_outcomes);
})():null);
var report = cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),new cljs.core.Keyword(null,"lookup-summary","lookup-summary",1485614183),new cljs.core.Keyword(null,"db-validation-enabled","db-validation-enabled",-362301625),new cljs.core.Keyword(null,"started-at","started-at",1318767912),new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),new cljs.core.Keyword(null,"single-query-prefetch-summary","single-query-prefetch-summary",836522667),new cljs.core.Keyword(null,"legend-count","legend-count",-564620371),new cljs.core.Keyword(null,"loop-count","loop-count",792041806),new cljs.core.Keyword(null,"single-query-db-validation-enabled","single-query-db-validation-enabled",-1024383058),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),new cljs.core.Keyword(null,"lookup-spec-count","lookup-spec-count",-1820151341),new cljs.core.Keyword(null,"single-query-legacy-compare","single-query-legacy-compare",237231060),new cljs.core.Keyword(null,"db-env-name","db-env-name",-1250740875),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989),new cljs.core.Keyword(null,"lookup-enabled-spec-count","lookup-enabled-spec-count",-152316203),new cljs.core.Keyword(null,"rule-count","rule-count",-1633498761),new cljs.core.Keyword(null,"context-keys","context-keys",-844838600),new cljs.core.Keyword(null,"element-row-count","element-row-count",1398185528),new cljs.core.Keyword(null,"rule-kind-counts","rule-kind-counts",1300665),new cljs.core.Keyword(null,"elapsed-ms","elapsed-ms",436005978),new cljs.core.Keyword(null,"validation","validation",-2141396518),new cljs.core.Keyword(null,"run-id","run-id",-1745267908)],[subscriber_statuses,new cljs.core.Keyword(null,"lookup","lookup",1225356838).cljs$core$IFn$_invoke$arity$1(stats),db_enabled_QMARK_,started_at,lookup_spec_file,(cljs.core.truth_(prefetch_data)?new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"ok","ok",967785236),new cljs.core.Keyword(null,"ok","ok",967785236).cljs$core$IFn$_invoke$arity$1(prefetch_data),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417),new cljs.core.Keyword(null,"ssn-count","ssn-count",828484417).cljs$core$IFn$_invoke$arity$1(prefetch_data),new cljs.core.Keyword(null,"row-count","row-count",1060167988),new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data),new cljs.core.Keyword(null,"spec-count","spec-count",640286431),new cljs.core.Keyword(null,"spec-count","spec-count",640286431).cljs$core$IFn$_invoke$arity$1(prefetch_data),new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(prefetch_data)], null):null),cljs.core.count.call(null,new cljs.core.Keyword(null,"legend","legend",-1027192245).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.count.call(null,new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.boolean$.call(null,(function (){var and__5140__auto__ = db_enabled_QMARK_;
if(and__5140__auto__){
var and__5140__auto____$1 = single_query_db_validation_QMARK_;
if(and__5140__auto____$1){
return prefetch_data;
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})()),cljs.core.count.call(null,cljs.core.concat.call(null,new cljs.core.Keyword(null,"subscribers","subscribers",-606401562).cljs$core$IFn$_invoke$arity$1(db_state),(function (){var temp__5825__auto__ = new cljs.core.Keyword(null,"current-subscriber","current-subscriber",-1261955038).cljs$core$IFn$_invoke$arity$1(db_state);
if(cljs.core.truth_(temp__5825__auto__)){
var cur = temp__5825__auto__;
return new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cur], null);
} else {
return null;
}
})())),cljs.core.count.call(null,new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc)),(cljs.core.truth_(comparison)?cljs.core.assoc.call(null,comparison,new cljs.core.Keyword(null,"enabled","enabled",1195909756),true,new cljs.core.Keyword(null,"performed","performed",1002519565),true):null),new cljs.core.Keyword(null,"env-name","env-name",1998966009).cljs$core$IFn$_invoke$arity$1(db_config),subscriber_progress_summary,cljs.core.count.call(null,cljs.core.filter.call(null,new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),new cljs.core.Keyword(null,"specs","specs",1426570741).cljs$core$IFn$_invoke$arity$1(lookup_doc))),cljs.core.count.call(null,rules),cljs.core.count.call(null,context),cljs.core.count.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(model)),cljs.core.frequencies.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"kind","kind",-717265803),rules)),elapsed_ms,stats,run_id]);
org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"run-rule-harness:result-built-trees-still-retained",new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),new cljs.core.Keyword(null,"failed","failed",-1397425762).cljs$core$IFn$_invoke$arity$1(stats),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,subscriber_statuses),new cljs.core.Keyword(null,"db-row-count","db-row-count",387477936),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"row-count","row-count",1060167988).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})(),new cljs.core.Keyword(null,"db-cache-count","db-cache-count",-1471004147),cljs.core.count.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"values","values",372645556).cljs$core$IFn$_invoke$arity$1(prefetch_data);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})())], null));

return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"report","report",1394055010),report,new cljs.core.Keyword(null,"rules","rules",1198912366),rules,new cljs.core.Keyword(null,"parsed-tree","parsed-tree",1040023394),(((!(new cljs.core.Keyword(null,"include-parsed?","include-parsed?",-260661768).cljs$core$IFn$_invoke$arity$1(opts) === false)))?parse_tree:null),new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771),(((!(new cljs.core.Keyword(null,"include-enriched?","include-enriched?",-1272866002).cljs$core$IFn$_invoke$arity$1(opts) === false)))?annotated_tree:null),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),org.kp.kpmc.companion_rules.collect_invalid_findings.call(null,annotated_tree,(1))], null);
}
}));

(org.kp.kpmc.companion_rules.run_rule_harness.cljs$lang$maxFixedArity = 3);

/**
 * Convenience harness for local baseline checks using test1.txt.
 */
org.kp.kpmc.companion_rules.run_rule_harness_on_test1 = (function org$kp$kpmc$companion_rules$run_rule_harness_on_test1(){
return org.kp.kpmc.companion_rules.run_rule_harness.call(null,"src/main/resources/TrentonSystemsInc_GA_CompanionDoc_5010a1-2025-12-29.csv","src/main/resources/edisamples/test1.txt");
});
org.kp.kpmc.companion_rules.ensure_parent_dir_BANG_ = (function org$kp$kpmc$companion_rules$ensure_parent_dir_BANG_(output_file){
return org.kp.kpmc.companion_rules.ensure_parent_dir_for_file_BANG_.call(null,output_file);
});
/**
 * Run harness and write pretty EDN output to file.
 * Returns {:output-file ... :result ...}.
 */
org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_ = (function org$kp$kpmc$companion_rules$write_rule_harness_edn_BANG_(var_args){
var G__2400 = arguments.length;
switch (G__2400) {
case 3:
return org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
case 4:
return org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_.cljs$core$IFn$_invoke$arity$4((arguments[(0)]),(arguments[(1)]),(arguments[(2)]),(arguments[(3)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_.cljs$core$IFn$_invoke$arity$3 = (function (companion_csv,edi_file,output_file){
cljs.core.println.call(null,"[write-rule-harness-edn!]");

var result = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file);
var edn_text = org.kp.kpmc.io_node.to_edn_text.call(null,result);
org.kp.kpmc.companion_rules.ensure_parent_dir_BANG_.call(null,output_file);

org.kp.kpmc.io_node.write_text.call(null,output_file,edn_text);

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"output-file","output-file",-907928512),output_file,new cljs.core.Keyword(null,"result","result",1415092211),result], null);
}));

(org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_.cljs$core$IFn$_invoke$arity$4 = (function (companion_csv,edi_file,output_file,opts){
var result = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,opts);
var edn_text = org.kp.kpmc.io_node.to_edn_text.call(null,result);
org.kp.kpmc.companion_rules.ensure_parent_dir_BANG_.call(null,output_file);

org.kp.kpmc.io_node.write_text.call(null,output_file,edn_text);

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"output-file","output-file",-907928512),output_file,new cljs.core.Keyword(null,"result","result",1415092211),result], null);
}));

(org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_.cljs$lang$maxFixedArity = 4);

/**
 * Run the existing harness and write a data-only EDN report for local review.
 */
org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_ = (function org$kp$kpmc$companion_rules$write_validation_review_edn_BANG_(var_args){
var G__2403 = arguments.length;
switch (G__2403) {
case 3:
return org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
case 4:
return org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_.cljs$core$IFn$_invoke$arity$4((arguments[(0)]),(arguments[(1)]),(arguments[(2)]),(arguments[(3)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_.cljs$core$IFn$_invoke$arity$3 = (function (companion_csv,edi_file,output_file){
return org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_.call(null,companion_csv,edi_file,output_file,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_.cljs$core$IFn$_invoke$arity$4 = (function (companion_csv,edi_file,output_file,opts){
var result = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,opts);
var report = new cljs.core.Keyword(null,"report","report",1394055010).cljs$core$IFn$_invoke$arity$1(result);
var review = new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"inputs","inputs",865803858),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"companion-guide","companion-guide",-798701121),companion_csv,new cljs.core.Keyword(null,"edi-file","edi-file",-1931664039),edi_file], null),new cljs.core.Keyword(null,"report","report",1394055010),report,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110),new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(report),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"parsed-tree","parsed-tree",1040023394),new cljs.core.Keyword(null,"parsed-tree","parsed-tree",1040023394).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771),new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771).cljs$core$IFn$_invoke$arity$1(result)], null);
org.kp.kpmc.companion_rules.ensure_parent_dir_BANG_.call(null,output_file);

org.kp.kpmc.io_node.write_text.call(null,output_file,org.kp.kpmc.io_node.to_edn_text.call(null,review));

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"output-file","output-file",-907928512),output_file,new cljs.core.Keyword(null,"review","review",1101692435),review], null);
}));

(org.kp.kpmc.companion_rules.write_validation_review_edn_BANG_.cljs$lang$maxFixedArity = 4);

/**
 * Run harness and write pretty JSON output to file.
 * Returns {:output-file ... :result ...}.
 */
org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_ = (function org$kp$kpmc$companion_rules$write_rule_harness_json_BANG_(var_args){
var G__2406 = arguments.length;
switch (G__2406) {
case 3:
return org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
case 4:
return org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_.cljs$core$IFn$_invoke$arity$4((arguments[(0)]),(arguments[(1)]),(arguments[(2)]),(arguments[(3)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_.cljs$core$IFn$_invoke$arity$3 = (function (companion_csv,edi_file,output_file){
var result = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file);
var json_text = JSON.stringify(cljs.core.clj__GT_js.call(null,result),null,(2));
org.kp.kpmc.companion_rules.ensure_parent_dir_BANG_.call(null,output_file);

org.kp.kpmc.io_node.write_text.call(null,output_file,json_text);

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"output-file","output-file",-907928512),output_file,new cljs.core.Keyword(null,"result","result",1415092211),result], null);
}));

(org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_.cljs$core$IFn$_invoke$arity$4 = (function (companion_csv,edi_file,output_file,opts){
var result = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,opts);
var json_text = JSON.stringify(cljs.core.clj__GT_js.call(null,result),null,(2));
org.kp.kpmc.companion_rules.ensure_parent_dir_BANG_.call(null,output_file);

org.kp.kpmc.io_node.write_text.call(null,output_file,json_text);

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"output-file","output-file",-907928512),output_file,new cljs.core.Keyword(null,"result","result",1415092211),result], null);
}));

(org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_.cljs$lang$maxFixedArity = 4);

org.kp.kpmc.companion_rules.default_json_output_file = (function org$kp$kpmc$companion_rules$default_json_output_file(edn_output_file){
if(clojure.string.ends_with_QMARK_.call(null,(function (){var or__5142__auto__ = edn_output_file;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})(),".edn")){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.subs.call(null,edn_output_file,(0),(cljs.core.count.call(null,edn_output_file) - (4))))+".json");
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(edn_output_file)+".json");
}
});
/**
 * Run run-rule-harness-on-test1 and write pretty EDN output for detailed review.
 *   Also writes JSON output alongside EDN.
 *   Default outputs: save/rule-harness-test1.edn and save/rule-harness-test1.json
 */
org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_ = (function org$kp$kpmc$companion_rules$write_rule_harness_on_test1_edn_BANG_(var_args){
var G__2409 = arguments.length;
switch (G__2409) {
case 0:
return org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_.cljs$core$IFn$_invoke$arity$0();

break;
case 1:
return org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_.cljs$core$IFn$_invoke$arity$0 = (function (){
cljs.core.println.call(null,"just checking.....");

return org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_.call(null,"save/rule-harness-test1.edn");
}));

(org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_.cljs$core$IFn$_invoke$arity$1 = (function (output_file){
var companion_csv = "src/main/resources/TrentonSystemsInc_GA_CompanionDoc_5010a1-2025-12-29.csv";
var edi_file = "src/main/resources/edisamples/test1.txt";
var json_output_file = org.kp.kpmc.companion_rules.default_json_output_file.call(null,output_file);
var edn_resp = org.kp.kpmc.companion_rules.write_rule_harness_edn_BANG_.call(null,companion_csv,edi_file,output_file);
var json_resp = org.kp.kpmc.companion_rules.write_rule_harness_json_BANG_.call(null,companion_csv,edi_file,json_output_file);
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"edn-output-file","edn-output-file",84595148),new cljs.core.Keyword(null,"output-file","output-file",-907928512).cljs$core$IFn$_invoke$arity$1(edn_resp),new cljs.core.Keyword(null,"json-output-file","json-output-file",1959735214),new cljs.core.Keyword(null,"output-file","output-file",-907928512).cljs$core$IFn$_invoke$arity$1(json_resp),new cljs.core.Keyword(null,"result","result",1415092211),new cljs.core.Keyword(null,"result","result",1415092211).cljs$core$IFn$_invoke$arity$1(edn_resp)], null);
}));

(org.kp.kpmc.companion_rules.write_rule_harness_on_test1_edn_BANG_.cljs$lang$maxFixedArity = 1);


//# sourceMappingURL=companion_rules.js.map
