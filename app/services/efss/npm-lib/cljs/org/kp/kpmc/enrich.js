// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.enrich');
goog.require('cljs.core');
goog.require('clojure.string');
goog.require('cljs.reader');
goog.require('org.kp.kpmc.companion');
goog.require('org.kp.kpmc.io_node');
/**
 * Build lookup index from companion guide: segment-id -> [loop-defs].
 */
org.kp.kpmc.enrich.build_companion_index = (function org$kp$kpmc$enrich$build_companion_index(companion_guide){
return cljs.core.group_by.call(null,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"loops","loops",-1766681555).cljs$core$IFn$_invoke$arity$1(companion_guide));
});
/**
 * Find matching loop definition for a segment id and first element value.
 */
org.kp.kpmc.enrich.find_loop_def = (function org$kp$kpmc$enrich$find_loop_def(index,seg_id,first_elem_value){
var candidates = cljs.core.get.call(null,index,seg_id);
if(cljs.core.seq.call(null,candidates)){
if(cljs.core._EQ_.call(null,(1),cljs.core.count.call(null,candidates))){
return cljs.core.first.call(null,candidates);
} else {
var or__5142__auto__ = cljs.core.some.call(null,(function (p1__2124_SHARP_){
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(p1__2124_SHARP_))),first_elem_value)){
return p1__2124_SHARP_;
} else {
return null;
}
}),candidates);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = cljs.core.some.call(null,(function (p1__2125_SHARP_){
var kp = new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(cljs.core.first.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(p1__2125_SHARP_)));
if(cljs.core.truth_((function (){var and__5140__auto__ = kp;
if(cljs.core.truth_(and__5140__auto__)){
var and__5140__auto____$1 = first_elem_value;
if(cljs.core.truth_(and__5140__auto____$1)){
return clojure.string.includes_QMARK_.call(null,kp,first_elem_value);
} else {
return and__5140__auto____$1;
}
} else {
return and__5140__auto__;
}
})())){
return p1__2125_SHARP_;
} else {
return null;
}
}),candidates);
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return cljs.core.first.call(null,candidates);
}
}
}
} else {
return null;
}
});
/**
 * Annotate unit child nodes with companion guide element metadata.
 */
org.kp.kpmc.enrich.annotate_children = (function org$kp$kpmc$enrich$annotate_children(children,elements,unit_tag){
var positioned_elements = cljs.core.vec.call(null,cljs.core.sort_by.call(null,(function (p1__2126_SHARP_){
var or__5142__auto__ = new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.companion.parse_segment_ref.call(null,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(p1__2126_SHARP_)));
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
}),elements));
return cljs.core.first.call(null,cljs.core.reduce.call(null,(function (p__2127,child){
var vec__2128 = p__2127;
var result = cljs.core.nth.call(null,vec__2128,(0),null);
var idx = cljs.core.nth.call(null,vec__2128,(1),null);
if(((cljs.core.sequential_QMARK_.call(null,child)) && (cljs.core._EQ_.call(null,unit_tag,cljs.core.first.call(null,child))))){
var elem = cljs.core.nth.call(null,positioned_elements,idx,null);
var val = cljs.core.second.call(null,child);
var annotated = (cljs.core.truth_(elem)?new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [unit_tag,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"ref","ref",1289896967),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(elem),new cljs.core.Keyword(null,"name","name",1843675177),new cljs.core.Keyword(null,"segment-name","segment-name",532881788).cljs$core$IFn$_invoke$arity$1(elem),new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(elem)], null),val], null):child);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.conj.call(null,result,annotated),(idx + (1))], null);
} else {
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.conj.call(null,result,child),idx], null);
}
}),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.PersistentVector.EMPTY,(0)], null),children));
});
/**
 * Parse kp-element spec into a set of literal allowed values.
 */
org.kp.kpmc.enrich.parse_kp_allowed_values = (function org$kp$kpmc$enrich$parse_kp_allowed_values(kp_element){
if(cljs.core.truth_((function (){var and__5140__auto__ = kp_element;
if(cljs.core.truth_(and__5140__auto__)){
return (!(clojure.string.blank_QMARK_.call(null,kp_element)));
} else {
return and__5140__auto__;
}
})())){
var trimmed = clojure.string.trim.call(null,kp_element);
if(clojure.string.starts_with_QMARK_.call(null,trimmed,"<")){
return null;
} else {
if(cljs.core._EQ_.call(null,trimmed,"All values")){
return null;
} else {
if(cljs.core.truth_(cljs.core.re_matches.call(null,/X+/,trimmed))){
return null;
} else {
if(clojure.string.includes_QMARK_.call(null,trimmed," or ")){
var parts = clojure.string.split.call(null,trimmed,/\s+or\s+/);
var left_parts = (((cljs.core.count.call(null,parts) > (1)))?clojure.string.split.call(null,cljs.core.first.call(null,parts),/,\s*/):null);
var right = cljs.core.last.call(null,parts);
return cljs.core.set.call(null,cljs.core.map.call(null,clojure.string.trim,cljs.core.concat.call(null,(function (){var or__5142__auto__ = left_parts;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,parts)], null);
}
})(),new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [right], null))));
} else {
if(clojure.string.includes_QMARK_.call(null,trimmed,",")){
return cljs.core.set.call(null,cljs.core.map.call(null,clojure.string.trim,clojure.string.split.call(null,trimmed,/,\s*/)));
} else {
return cljs.core.PersistentHashSet.createAsIfByAssoc([trimmed]);

}
}
}
}
}
} else {
return null;
}
});
org.kp.kpmc.enrich.kp_format_patterns = new cljs.core.PersistentArrayMap(null, 7, ["<YYMMDD>",/\d{6}/,"<CCYYMMDD>",/\d{8}/,"<HHMM>",/\d{4}/,"<HHMMSS>",/\d{6}/,"<HHMMSSDD>",/\d{6,8}/,"<Number>",/\d+/,"<Unique Number>",/.+/], null);
/**
 * Validate actual-value against kp-element placeholder pattern.
 */
org.kp.kpmc.enrich.validate_kp_format = (function org$kp$kpmc$enrich$validate_kp_format(kp_element,actual_value,ref){
var temp__5825__auto__ = cljs.core.get.call(null,org.kp.kpmc.enrich.kp_format_patterns,kp_element);
if(cljs.core.truth_(temp__5825__auto__)){
var pattern = temp__5825__auto__;
if(cljs.core.truth_((function (){var and__5140__auto__ = actual_value;
if(cljs.core.truth_(and__5140__auto__)){
return (((!(clojure.string.blank_QMARK_.call(null,actual_value)))) && (cljs.core.not.call(null,cljs.core.re_matches.call(null,pattern,actual_value))));
} else {
return and__5140__auto__;
}
})())){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ref)+" format mismatch: expected "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(kp_element)+" but got '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(actual_value)+"'");
} else {
return null;
}
} else {
return null;
}
});
/**
 * Validate a single element against companion guide definition.
 */
org.kp.kpmc.enrich.validate_element = (function org$kp$kpmc$enrich$validate_element(elem_def,actual_value){
if(cljs.core.truth_(elem_def)){
var usage = new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(elem_def);
var kp_element = new cljs.core.Keyword(null,"kp-element","kp-element",1092855431).cljs$core$IFn$_invoke$arity$1(elem_def);
var ref = new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(elem_def);
var trimmed = (cljs.core.truth_(actual_value)?clojure.string.trim.call(null,actual_value):null);
var blank_QMARK_ = (((actual_value == null)) || (clojure.string.blank_QMARK_.call(null,actual_value)));
if(cljs.core._EQ_.call(null,usage,new cljs.core.Keyword(null,"not-used","not-used",-330157808))){
if(blank_QMARK_){
return null;
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ref)+" is Not Used and must be blank, but got '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(actual_value)+"'");
}
} else {
if(cljs.core._EQ_.call(null,kp_element,"<Blank>")){
if((!(blank_QMARK_))){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ref)+" should be blank (empty or spaces) but got '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(actual_value)+"'");
} else {
return null;
}
} else {
if(((cljs.core._EQ_.call(null,usage,new cljs.core.Keyword(null,"required","required",1807647006))) && (blank_QMARK_))){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ref)+" is required but empty");
} else {
if(blank_QMARK_){
return null;
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = kp_element;
if(cljs.core.truth_(and__5140__auto__)){
return clojure.string.starts_with_QMARK_.call(null,kp_element,"<");
} else {
return and__5140__auto__;
}
})())){
return org.kp.kpmc.enrich.validate_kp_format.call(null,kp_element,trimmed,ref);
} else {
var allowed = org.kp.kpmc.enrich.parse_kp_allowed_values.call(null,kp_element);
if(cljs.core.truth_((function (){var and__5140__auto__ = allowed;
if(cljs.core.truth_(and__5140__auto__)){
return (!(cljs.core.contains_QMARK_.call(null,allowed,trimmed)));
} else {
return and__5140__auto__;
}
})())){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(ref)+" value '"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(actual_value)+"' not in allowed values: "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(allowed));
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
/**
 * Annotate unit nodes with companion metadata and validation status.
 */
org.kp.kpmc.enrich.annotate_and_validate_children = (function org$kp$kpmc$enrich$annotate_and_validate_children(children,elements,unit_tag){
var positioned_elements = cljs.core.vec.call(null,cljs.core.sort_by.call(null,(function (p1__2131_SHARP_){
var or__5142__auto__ = new cljs.core.Keyword(null,"position","position",-2011731912).cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.companion.parse_segment_ref.call(null,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(p1__2131_SHARP_)));
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
}),elements));
var map__2132 = cljs.core.reduce.call(null,(function (p__2133,child){
var map__2134 = p__2133;
var map__2134__$1 = cljs.core.__destructure_map.call(null,map__2134);
var result = cljs.core.get.call(null,map__2134__$1,new cljs.core.Keyword(null,"result","result",1415092211));
var errors = cljs.core.get.call(null,map__2134__$1,new cljs.core.Keyword(null,"errors","errors",-908790718));
var idx = cljs.core.get.call(null,map__2134__$1,new cljs.core.Keyword(null,"idx","idx",1053688473));
if(((cljs.core.sequential_QMARK_.call(null,child)) && (cljs.core._EQ_.call(null,unit_tag,cljs.core.first.call(null,child))))){
var elem = cljs.core.nth.call(null,positioned_elements,idx,null);
var val = cljs.core.second.call(null,child);
var error = org.kp.kpmc.enrich.validate_element.call(null,elem,val);
var elem_meta = (cljs.core.truth_(elem)?(function (){var base = new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"ref","ref",1289896967),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(elem),new cljs.core.Keyword(null,"name","name",1843675177),new cljs.core.Keyword(null,"segment-name","segment-name",532881788).cljs$core$IFn$_invoke$arity$1(elem),new cljs.core.Keyword(null,"usage","usage",-1583752910),new cljs.core.Keyword(null,"usage","usage",-1583752910).cljs$core$IFn$_invoke$arity$1(elem),new cljs.core.Keyword(null,"valid","valid",155614240),(error == null)], null);
if(cljs.core.truth_(error)){
return cljs.core.assoc.call(null,base,new cljs.core.Keyword(null,"invalid-description","invalid-description",97638859),error);
} else {
return base;
}
})():null);
var annotated = (cljs.core.truth_(elem_meta)?new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, [unit_tag,elem_meta,val], null):child);
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"result","result",1415092211),cljs.core.conj.call(null,result,annotated),new cljs.core.Keyword(null,"errors","errors",-908790718),(cljs.core.truth_(error)?cljs.core.conj.call(null,errors,error):errors),new cljs.core.Keyword(null,"idx","idx",1053688473),(idx + (1))], null);
} else {
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"result","result",1415092211),cljs.core.conj.call(null,result,child),new cljs.core.Keyword(null,"errors","errors",-908790718),errors,new cljs.core.Keyword(null,"idx","idx",1053688473),idx], null);
}
}),new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"result","result",1415092211),cljs.core.PersistentVector.EMPTY,new cljs.core.Keyword(null,"errors","errors",-908790718),cljs.core.PersistentVector.EMPTY,new cljs.core.Keyword(null,"idx","idx",1053688473),(0)], null),children);
var map__2132__$1 = cljs.core.__destructure_map.call(null,map__2132);
var result = cljs.core.get.call(null,map__2132__$1,new cljs.core.Keyword(null,"result","result",1415092211));
var errors = cljs.core.get.call(null,map__2132__$1,new cljs.core.Keyword(null,"errors","errors",-908790718));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"children","children",-940561982),result,new cljs.core.Keyword(null,"errors","errors",-908790718),errors], null);
});
/**
 * Walk parse tree and annotate segments/elements with companion guide metadata.
 */
org.kp.kpmc.enrich.enrich_parse_tree = (function org$kp$kpmc$enrich$enrich_parse_tree(parse_tree,companion_guide){
var index = org.kp.kpmc.enrich.build_companion_index.call(null,companion_guide);
var make_segment_meta = (function (loop_def,errors){
var base = new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(loop_def)], null);
if(cljs.core.seq.call(null,errors)){
return cljs.core.assoc.call(null,base,new cljs.core.Keyword(null,"valid","valid",155614240),false,new cljs.core.Keyword(null,"invalid-description","invalid-description",97638859),clojure.string.join.call(null,"; ",errors));
} else {
return cljs.core.assoc.call(null,base,new cljs.core.Keyword(null,"valid","valid",155614240),true);
}
});
var enrich = (function org$kp$kpmc$enrich$enrich_parse_tree_$_enrich(node){
if((!(cljs.core.sequential_QMARK_.call(null,node)))){
return node;
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"isa_data_segment","isa_data_segment",20390465),cljs.core.first.call(null,node))){
var isa_def = cljs.core.first.call(null,cljs.core.get.call(null,index,"ISA"));
var children = cljs.core.vec.call(null,cljs.core.rest.call(null,node));
if(cljs.core.truth_(isa_def)){
var map__2136 = org.kp.kpmc.enrich.annotate_and_validate_children.call(null,children,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(isa_def),new cljs.core.Keyword(null,"isa_data_segment_unit","isa_data_segment_unit",-1607478857));
var map__2136__$1 = cljs.core.__destructure_map.call(null,map__2136);
var children__$1 = cljs.core.get.call(null,map__2136__$1,new cljs.core.Keyword(null,"children","children",-940561982));
var errors = cljs.core.get.call(null,map__2136__$1,new cljs.core.Keyword(null,"errors","errors",-908790718));
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"isa_data_segment","isa_data_segment",20390465),make_segment_meta.call(null,isa_def,errors)], null),children__$1);
} else {
return node;
}
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"iea_data_segment","iea_data_segment",990313449),cljs.core.first.call(null,node))){
var iea_def = cljs.core.first.call(null,cljs.core.get.call(null,index,"IEA"));
var children = cljs.core.vec.call(null,cljs.core.rest.call(null,node));
if(cljs.core.truth_(iea_def)){
var map__2137 = org.kp.kpmc.enrich.annotate_and_validate_children.call(null,children,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(iea_def),new cljs.core.Keyword(null,"data_segment_unit","data_segment_unit",275172820));
var map__2137__$1 = cljs.core.__destructure_map.call(null,map__2137);
var children__$1 = cljs.core.get.call(null,map__2137__$1,new cljs.core.Keyword(null,"children","children",-940561982));
var errors = cljs.core.get.call(null,map__2137__$1,new cljs.core.Keyword(null,"errors","errors",-908790718));
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"iea_data_segment","iea_data_segment",990313449),make_segment_meta.call(null,iea_def,errors)], null),children__$1);
} else {
return node;
}
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"function_header","function_header",-45502077),cljs.core.first.call(null,node))){
var gs_def = cljs.core.first.call(null,cljs.core.get.call(null,index,"GS"));
if(cljs.core.truth_(gs_def)){
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"function_header","function_header",-45502077),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(gs_def),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(gs_def),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(gs_def),new cljs.core.Keyword(null,"valid","valid",155614240),true], null)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
}
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"function_trailer","function_trailer",1638839361),cljs.core.first.call(null,node))){
var ge_def = cljs.core.first.call(null,cljs.core.get.call(null,index,"GE"));
if(cljs.core.truth_(ge_def)){
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"function_trailer","function_trailer",1638839361),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(ge_def),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(ge_def),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(ge_def),new cljs.core.Keyword(null,"valid","valid",155614240),true], null)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
}
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"trans_set_header","trans_set_header",-1079013849),cljs.core.first.call(null,node))){
var st_def = cljs.core.first.call(null,cljs.core.get.call(null,index,"ST"));
if(cljs.core.truth_(st_def)){
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_set_header","trans_set_header",-1079013849),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(st_def),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(st_def),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(st_def),new cljs.core.Keyword(null,"valid","valid",155614240),true], null)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
}
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"trans_set_trailer","trans_set_trailer",-1537804660),cljs.core.first.call(null,node))){
var se_def = cljs.core.first.call(null,cljs.core.get.call(null,index,"SE"));
if(cljs.core.truth_(se_def)){
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_set_trailer","trans_set_trailer",-1537804660),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-name","loop-name",468086403).cljs$core$IFn$_invoke$arity$1(se_def),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(se_def),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229),new cljs.core.Keyword(null,"segment-requirement","segment-requirement",-1307113229).cljs$core$IFn$_invoke$arity$1(se_def),new cljs.core.Keyword(null,"valid","valid",155614240),true], null)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));
}
} else {
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"data_segment","data_segment",992974211),cljs.core.first.call(null,node))){
var children = cljs.core.vec.call(null,cljs.core.rest.call(null,node));
var seg_id_node = cljs.core.first.call(null,children);
var seg_id = ((((cljs.core.sequential_QMARK_.call(null,seg_id_node)) && (cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"seg_id","seg_id",300399285),cljs.core.first.call(null,seg_id_node)))))?cljs.core.second.call(null,seg_id_node):null);
var first_unit = cljs.core.first.call(null,cljs.core.filter.call(null,(function (p1__2135_SHARP_){
return ((cljs.core.sequential_QMARK_.call(null,p1__2135_SHARP_)) && (cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"data_segment_unit","data_segment_unit",275172820),cljs.core.first.call(null,p1__2135_SHARP_))));
}),children));
var first_val = (cljs.core.truth_(first_unit)?cljs.core.second.call(null,first_unit):null);
var loop_def = (cljs.core.truth_(seg_id)?org.kp.kpmc.enrich.find_loop_def.call(null,index,seg_id,first_val):null);
if(cljs.core.truth_(loop_def)){
var map__2138 = org.kp.kpmc.enrich.annotate_and_validate_children.call(null,children,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(loop_def),new cljs.core.Keyword(null,"data_segment_unit","data_segment_unit",275172820));
var map__2138__$1 = cljs.core.__destructure_map.call(null,map__2138);
var children__$1 = cljs.core.get.call(null,map__2138__$1,new cljs.core.Keyword(null,"children","children",-940561982));
var errors = cljs.core.get.call(null,map__2138__$1,new cljs.core.Keyword(null,"errors","errors",-908790718));
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"data_segment","data_segment",992974211),make_segment_meta.call(null,loop_def,errors)], null),children__$1);
} else {
return node;
}
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,node)], null),cljs.core.map.call(null,org$kp$kpmc$enrich$enrich_parse_tree_$_enrich,cljs.core.rest.call(null,node)));

}
}
}
}
}
}
}
}
});
return enrich.call(null,parse_tree);
});
/**
 * Read parsed X12 EDN and companion EDN files, return enriched parse tree.
 */
org.kp.kpmc.enrich.enrich_x12_with_companion_guide = (function org$kp$kpmc$enrich$enrich_x12_with_companion_guide(parse_edn_file,companion_edn_file){
var parse_tree = cljs.reader.read_string.call(null,org.kp.kpmc.io_node.read_text.call(null,parse_edn_file));
var companion_guide = cljs.reader.read_string.call(null,org.kp.kpmc.io_node.read_text.call(null,companion_edn_file));
return org.kp.kpmc.enrich.enrich_parse_tree.call(null,parse_tree,companion_guide);
});

//# sourceMappingURL=enrich.js.map
