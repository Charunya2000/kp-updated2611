// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.parser');
goog.require('cljs.core');
goog.require('clojure.string');
goog.require('instaparse.core');
goog.require('org.kp.kpmc.io_node');
org.kp.kpmc.parser.x12_parser = instaparse.core.parser.call(null,"x12file ::= isa_data_segment {functional_group} iea_data_segment space? | isa_data_segment ta1_data_segment iea_data_segment space?\r\nisa_data_segment ::= \"ISA\" {<gs> [isa_data_segment_unit]} <gs> isa_data_segment_unit <tr>\r\n<tr> ::= #\"~[\\r\\n]*\"\r\n<gs> ::= \"*\"\r\n<us> ::= \":\"\r\n<rs> ::= \"+\"\r\nfunctional_group ::= function_header functional_block function_trailer\r\niea_data_segment ::= \"IEA\" {<gs> [data_segment_unit]} <gs> data_segment_unit <tr>\r\nisa_data_segment_unit ::= isa_repeating_composite_data_structure\r\nfunction_header ::= \"GS\" <gs> function_id <gs> app_sender_id <gs> app_receiver_id <gs> fg_date <gs> fg_time <gs> function_control_number <gs> standard <gs> version <tr>\r\nta1_data_segment ::= \"TA1\" {<gs> [data_segment_unit]} <gs> data_segment_unit <tr>\r\nfunctional_block ::= unsecured_function_block\r\nfunction_trailer ::= \"GE\" <gs> no_included_trans_sets <gs> function_control_number <tr>\r\ndata_segment_unit ::= repeating_simple_data_element | repeating_composite_data_structure\r\n<isa_repeating_composite_data_structure> ::= {[isa_composite_data_structure] <rs>} isa_composite_data_structure\r\nfunction_id ::= id\r\napp_sender_id ::= #\"[^*]*\"\r\napp_receiver_id ::= #\"[^*]*\"\r\nfg_date ::= #\"(\\d\\d)?\\d\\d(01|02|03|04|05|06|07|08|09|10|11|12)(01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31)\"\r\nfg_time ::= #\"(01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23)(00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|52|52|53|54|55|56|57|58|59)(00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|52|52|53|54|55|56|57|58|59)?\"\r\nfunction_control_number ::= #\"\\d+\"\r\nstandard ::= id\r\nversion ::= #\"[^*~]+\"\r\nunsecured_function_block ::= function_body\r\nno_included_trans_sets ::= #\"-?\\d+\"\r\n<repeating_simple_data_element> ::= {[simple_data_element] <rs>} simple_data_element\r\n<repeating_composite_data_structure> ::= {[composite_data_structure] <rs>} composite_data_structure\r\n<isa_composite_data_structure> ::= {[isa_component_data_element] <us>} isa_component_data_element\r\nid ::= #\"[A-Za-z0-9]+\\s*\"\r\nfunction_body ::= transaction_set {transaction_set}\r\n<simple_data_element> ::= data_element\r\n<composite_data_structure> ::= {[component_data_element] <us>} component_data_element\r\n<isa_component_data_element> ::= isa_data_element\r\n<space> ::= #\"(?m)\\s+\"\r\ntransaction_set ::= trans_set_header trans_block trans_set_trailer\r\n<data_element> ::= #\"[^*~]*\"\r\n<component_data_element> ::= data_element\r\n<isa_data_element> ::= #\"[^*~]+\"\r\ntrans_set_header ::= \"ST\" <gs> trans_set_id <gs> trans_set_control_number {<gs> ic_id_string} <tr>\r\ntrans_block ::= unsecured_trans_block\r\ntrans_set_trailer ::= \"SE\" <gs> number_of_included_segments <gs> trans_set_control_number <tr>\r\ntrans_set_id ::= id\r\ntrans_set_control_number ::= #\"[^*~]+\"\r\nic_id_string ::= #\"[^*~]+\"\r\nunsecured_trans_block ::= trans_body\r\nnumber_of_included_segments ::= #\"\\d+\"\r\ntrans_body ::= data_segment_group {data_segment_group}\r\ndata_segment_group ::= data_segment | data_segment_repeat | data_segment_loop | bounded_loop\r\ndata_segment ::= seg_id {<gs> [data_segment_unit]} <gs> data_segment_unit <tr>\r\ndata_segment_repeat ::= {data_segment}\r\ndata_segment_loop ::= loop_beg_seg {loop_body}\r\nbounded_loop ::= loop_header data_segment_loop {data_segment_loop} loop_trailer\r\nseg_id ::= #\"[A-Za-z0-9]+\"\r\nloop_beg_seg ::= data_segment\r\nloop_body ::= data_segment | data_segment_group\r\nloop_header ::= \"LS\" <gs> loop_id <tr>\r\nloop_trailer ::= \"LE\" <gs> loop_id <tr>\r\nloop_id ::= #\"[A-Z0-9]+\"\r\n");
org.kp.kpmc.parser.envelope_parser = instaparse.core.parser.call(null,"x12file ::= isa_data_segment {functional_group} iea_data_segment space? | isa_data_segment ta1_data_segment iea_data_segment space?\r\n\r\nisa_data_segment ::= \"ISA\" {<gs> [isa_data_segment_unit]} <gs> isa_data_segment_unit <tr>\r\nisa_data_segment_unit ::= isa_repeating_composite_data_structure\r\n<isa_repeating_composite_data_structure> ::= {[isa_composite_data_structure] <rs>} isa_composite_data_structure\r\n<isa_composite_data_structure> ::= {[isa_component_data_element] <us>} isa_component_data_element\r\n<isa_component_data_element> ::= isa_data_element\r\n<isa_data_element> ::= #\"[^*~]+\"\r\n\r\niea_data_segment ::= \"IEA\" {<gs> [data_segment_unit]} <gs> data_segment_unit <tr>\r\n\r\nta1_data_segment ::= \"TA1\" {<gs> [data_segment_unit]} <gs> data_segment_unit <tr>\r\n\r\ndata_segment_unit ::= repeating_simple_data_element | repeating_composite_data_structure\r\n<repeating_simple_data_element> ::= {[simple_data_element] <rs>} simple_data_element\r\n<repeating_composite_data_structure> ::= {[composite_data_structure] <rs>} composite_data_structure\r\n<simple_data_element> ::= data_element\r\n<composite_data_structure> ::= {[component_data_element] <us>} component_data_element\r\n<component_data_element> ::= data_element\r\n<data_element> ::= #\"[^*~]*\"\r\n\r\nfunctional_group ::= function_header functional_block function_trailer\r\n\r\nfunction_header ::= \"GS\" <gs> function_id <gs> app_sender_id <gs> app_receiver_id <gs> fg_date <gs> fg_time <gs> function_control_number <gs> standard <gs> version <tr>\r\nfunction_id ::= id\r\napp_sender_id ::= #\"[^*]*\"\r\napp_receiver_id ::= #\"[^*]*\"\r\nstandard ::= id\r\nid ::= #\"[A-Za-z0-9]+\\s*\"\r\nfg_date ::= #\"(\\d\\d)?\\d\\d(01|02|03|04|05|06|07|08|09|10|11|12)(01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31)\"\r\nfg_time ::= #\"(01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23)(00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|52|52|53|54|55|56|57|58|59)(00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|52|52|53|54|55|56|57|58|59)?\"\r\nfunction_control_number ::= #\"\\d+\"\r\nversion ::= #\"[^*~]+\"\r\n\r\nfunctional_block ::= unsecured_function_block\r\nunsecured_function_block ::= function_body\r\nfunction_body ::= {non_ge_segment}\r\nnon_ge_segment ::= !\"GE\" raw_segment\r\nraw_segment ::= #\"[^~]*\" <tr>\r\n\r\nfunction_trailer ::= \"GE\" <gs> no_included_trans_sets <gs> function_control_number <tr>\r\nno_included_trans_sets ::= #\"-?\\d+\"\r\n\r\n<tr> ::= #\"~[\\r\\n]*\"\r\n<gs> ::= \"*\"\r\n<us> ::= \":\"\r\n<rs> ::= \"+\"\r\n<space> ::= #\"(?m)\\s+\"\r\n");
org.kp.kpmc.parser.function_body_parser = instaparse.core.parser.call(null,"function_body ::= transaction_set {transaction_set}\r\ntransaction_set ::= trans_set_header trans_block trans_set_trailer\r\ntrans_set_header ::= \"ST\" <gs> trans_set_id <gs> trans_set_control_number {<gs> ic_id_string} <tr>\r\ntrans_set_trailer ::= \"SE\" <gs> number_of_included_segments <gs> trans_set_control_number <tr>\r\ntrans_block ::= unsecured_trans_block\r\nunsecured_trans_block ::= trans_body\r\nnumber_of_included_segments ::= #\"\\d+\"\r\ntrans_set_id ::= id\r\ntrans_set_control_number ::= #\"[^*~]+\"\r\nic_id_string ::= #\"[^*~]+\"\r\nid ::= #\"[A-Za-z0-9]+\\s*\"\r\ntrans_body ::= {non_se_segment}\r\nnon_se_segment ::= !\"SE\" raw_segment\r\nraw_segment ::= #\"[^~]*\" <tr>\r\n\r\n<tr> ::= #\"~[\\r\\n]*\"\r\n<gs> ::= \"*\"\r\n<us> ::= \":\"\r\n<rs> ::= \"+\"\r\n<space> ::= #\"(?m)\\s+\"\r\n");
org.kp.kpmc.parser.trans_body_parser = instaparse.core.parser.call(null,"trans_body ::= trans_preamble {ins_subscriber}\r\ntrans_preamble ::= {non_ins_segment}\r\n\r\nins_subscriber ::= ins_segment {ins_body_segment}\r\nins_segment ::= data_segment\r\nins_body_segment ::= !\"INS\" raw_segment\r\nnon_ins_segment ::= !\"INS\" raw_segment\r\n\r\ndata_segment ::= seg_id <gs> data_segment_unit {<gs> data_segment_unit} <tr>\r\nseg_id ::= \"INS\"\r\ndata_segment_unit ::= #\"[^*~]*\"\r\nraw_segment ::= #\"[^~]*\" <tr>\r\n\r\n<gs> ::= \"*\"\r\n<tr> ::= #\"~[\\r\\n]*\"\r\n<space> ::= #\"(?m)\\s+\"\r\n");
org.kp.kpmc.parser.ins_parser = instaparse.core.parser.call(null,"ins_subscriber ::= ins_segment {ins_body_segment}\r\n\r\nins_segment ::= data_segment\r\nins_body_segment ::= !\"INS\" raw_segment\r\n\r\ndata_segment ::= seg_id <gs> data_segment_unit {<gs> data_segment_unit} <tr>\r\nseg_id ::= \"INS\"\r\ndata_segment_unit ::= #\"[^*~]*\"\r\nraw_segment ::= #\"[^~]*\" <tr>\r\n\r\n<gs> ::= \"*\"\r\n<tr> ::= #\"~[\\r\\n]*\"\r\n<space> ::= #\"(?m)\\s+\"\r\n");
/**
 * Build parser from a resource file on disk, falling back to a precompiled parser.
 *   This keeps grammar-only edits effective without requiring code changes in this ns.
 */
org.kp.kpmc.parser.parser_from_resource = (function org$kp$kpmc$parser$parser_from_resource(resource_name,fallback_parser){
try{return instaparse.core.parser.call(null,org.kp.kpmc.io_node.read_text.call(null,(""+"src/main/resources/"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(resource_name))));
}catch (e2007){var _ = e2007;
return fallback_parser;
}});
org.kp.kpmc.parser.bytes__GT_mb = (function org$kp$kpmc$parser$bytes__GT_mb(n){
return (Math.round(((n * 10.0) / 1048576.0)) / 10.0);
});
/**
 * Return Node memory snapshot map or nil when unavailable.
 */
org.kp.kpmc.parser.memory_snapshot = (function org$kp$kpmc$parser$memory_snapshot(){
var temp__5825__auto__ = (function (){var G__2008 = process;
if((G__2008 == null)){
return null;
} else {
return G__2008.memoryUsage;
}
})();
if(cljs.core.truth_(temp__5825__auto__)){
var mu = temp__5825__auto__;
var m = mu.call(null);
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"rss-mb","rss-mb",-632838303),org.kp.kpmc.parser.bytes__GT_mb.call(null,m.rss),new cljs.core.Keyword(null,"heap-total-mb","heap-total-mb",1073078302),org.kp.kpmc.parser.bytes__GT_mb.call(null,m.heapTotal),new cljs.core.Keyword(null,"heap-used-mb","heap-used-mb",780572214),org.kp.kpmc.parser.bytes__GT_mb.call(null,m.heapUsed),new cljs.core.Keyword(null,"external-mb","external-mb",795066013),org.kp.kpmc.parser.bytes__GT_mb.call(null,m.external),new cljs.core.Keyword(null,"array-buffers-mb","array-buffers-mb",1199684962),org.kp.kpmc.parser.bytes__GT_mb.call(null,(function (){var or__5142__auto__ = m.arrayBuffers;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (0);
}
})())], null);
} else {
return null;
}
});
/**
 * Emit memory usage line when enabled.
 */
org.kp.kpmc.parser.log_memory_BANG_ = (function org$kp$kpmc$parser$log_memory_BANG_(enabled,stage,extra){
if(cljs.core.truth_(enabled)){
var temp__5825__auto__ = org.kp.kpmc.parser.memory_snapshot.call(null);
if(cljs.core.truth_(temp__5825__auto__)){
var m = temp__5825__auto__;
return cljs.core.println.call(null,(""+"[memory] "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(stage)+" "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.pr_str.call(null,cljs.core.merge.call(null,m,(function (){var or__5142__auto__ = extra;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})())))));
} else {
return null;
}
} else {
return null;
}
});
org.kp.kpmc.parser.reverso = (function org$kp$kpmc$parser$reverso(input){
return cljs.core.apply.call(null,cljs.core.str,cljs.core.reverse.call(null,input));
});
/**
 * Extract text from input string using span metadata [start end].
 */
org.kp.kpmc.parser.extract_text_by_span = (function org$kp$kpmc$parser$extract_text_by_span(input_text,span){
if(cljs.core.truth_(span)){
var vec__2009 = span;
var start = cljs.core.nth.call(null,vec__2009,(0),null);
var end = cljs.core.nth.call(null,vec__2009,(1),null);
return cljs.core.subs.call(null,input_text,start,end);
} else {
return null;
}
});
/**
 * Find first occurrence of a keyword tag in parse tree.
 */
org.kp.kpmc.parser.find_in_parse_tree = (function org$kp$kpmc$parser$find_in_parse_tree(tree,keyword){
if((!(cljs.core.sequential_QMARK_.call(null,tree)))){
return null;
} else {
if(cljs.core._EQ_.call(null,cljs.core.first.call(null,tree),keyword)){
return tree;
} else {
return cljs.core.some.call(null,(function (p1__2012_SHARP_){
return org.kp.kpmc.parser.find_in_parse_tree.call(null,p1__2012_SHARP_,keyword);
}),cljs.core.rest.call(null,tree));

}
}
});
/**
 * Find all occurrences of a keyword tag in parse tree.
 */
org.kp.kpmc.parser.find_all_nodes = (function org$kp$kpmc$parser$find_all_nodes(tree,kw){
if((!(cljs.core.sequential_QMARK_.call(null,tree)))){
return cljs.core.PersistentVector.EMPTY;
} else {
if(cljs.core._EQ_.call(null,cljs.core.first.call(null,tree),kw)){
return new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [tree], null);
} else {
return cljs.core.mapcat.call(null,(function (p1__2013_SHARP_){
return org.kp.kpmc.parser.find_all_nodes.call(null,p1__2013_SHARP_,kw);
}),cljs.core.rest.call(null,tree));

}
}
});
/**
 * Extract function_body source text. Prefer explicit raw_segment children and
 *   reconstruct delimiters; fall back to span extraction when needed.
 */
org.kp.kpmc.parser.function_body_node__GT_text = (function org$kp$kpmc$parser$function_body_node__GT_text(input_text,fb_node){
var raw_segments = cljs.core.vec.call(null,cljs.core.filter.call(null,cljs.core.string_QMARK_,cljs.core.map.call(null,cljs.core.second,org.kp.kpmc.parser.find_all_nodes.call(null,fb_node,new cljs.core.Keyword(null,"raw_segment","raw_segment",-482193833)))));
if(cljs.core.seq.call(null,raw_segments)){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"~",raw_segments))+"~");
} else {
var fb_span = instaparse.core.span.call(null,fb_node);
if(cljs.core.truth_(fb_span)){
return org.kp.kpmc.parser.extract_text_by_span.call(null,input_text,fb_span);
} else {
return null;
}
}
});
/**
 * Extract text from a node that contains raw_segment descendants.
 */
org.kp.kpmc.parser.raw_segment_node__GT_text = (function org$kp$kpmc$parser$raw_segment_node__GT_text(input_text,node){
var raw_segments = cljs.core.vec.call(null,cljs.core.filter.call(null,cljs.core.string_QMARK_,cljs.core.map.call(null,cljs.core.second,org.kp.kpmc.parser.find_all_nodes.call(null,node,new cljs.core.Keyword(null,"raw_segment","raw_segment",-482193833)))));
if(cljs.core.seq.call(null,raw_segments)){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"~",raw_segments))+"~");
} else {
var span = instaparse.core.span.call(null,node);
if(cljs.core.truth_(span)){
return org.kp.kpmc.parser.extract_text_by_span.call(null,input_text,span);
} else {
return null;
}
}
});
/**
 * Create parser map from compile-time defparser instances.
 */
org.kp.kpmc.parser.create_parsers = (function org$kp$kpmc$parser$create_parsers(){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"x12-parser","x12-parser",-292284666),org.kp.kpmc.parser.x12_parser,new cljs.core.Keyword(null,"envelope-parser","envelope-parser",-814202825),org.kp.kpmc.parser.envelope_parser,new cljs.core.Keyword(null,"function-body-parser","function-body-parser",1142718853),org.kp.kpmc.parser.function_body_parser,new cljs.core.Keyword(null,"trans-body-parser","trans-body-parser",139234072),org.kp.kpmc.parser.parser_from_resource.call(null,"x12_trans_body.ebnf",org.kp.kpmc.parser.trans_body_parser),new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282),org.kp.kpmc.parser.parser_from_resource.call(null,"x12_ins.ebnf",org.kp.kpmc.parser.ins_parser)], null);
});
/**
 * Split raw EDI text into ordered segment strings without terminators.
 */
org.kp.kpmc.parser.split_edi_segments = (function org$kp$kpmc$parser$split_edi_segments(text){
return cljs.core.vec.call(null,cljs.core.remove.call(null,clojure.string.blank_QMARK_,cljs.core.map.call(null,clojure.string.trim,clojure.string.split.call(null,text,/~/))));
});
/**
 * Return segment identifier from a raw segment string.
 */
org.kp.kpmc.parser.segment_id = (function org$kp$kpmc$parser$segment_id(segment){
return cljs.core.first.call(null,clojure.string.split.call(null,segment,/\*/,(2)));
});
/**
 * Join ordered raw segments back into EDI text with segment terminators.
 */
org.kp.kpmc.parser.segments__GT_edi_text = (function org$kp$kpmc$parser$segments__GT_edi_text(segments){
if(cljs.core.seq.call(null,segments)){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"~",segments))+"~");
} else {
return null;
}
});
/**
 * Find index of the next segment id between start (inclusive) and end (exclusive).
 */
org.kp.kpmc.parser.find_next_segment_index = (function org$kp$kpmc$parser$find_next_segment_index(segments,start,end,seg_id){
var i = start;
while(true){
if((i >= end)){
return (-1);
} else {
if(cljs.core._EQ_.call(null,seg_id,org.kp.kpmc.parser.segment_id.call(null,cljs.core.nth.call(null,segments,i)))){
return i;
} else {
var G__2014 = (i + (1));
i = G__2014;
continue;

}
}
break;
}
});
/**
 * Split full segment stream into ISA/IEA-bounded interchange windows.
 *   Returns vector of {:start i :end j} where end is exclusive.
 */
org.kp.kpmc.parser.split_segments_by_isa = (function org$kp$kpmc$parser$split_segments_by_isa(segments){
var n = cljs.core.count.call(null,segments);
var idx = (0);
var ranges = cljs.core.PersistentVector.EMPTY;
while(true){
if((idx >= n)){
return ranges;
} else {
var isa_idx = org.kp.kpmc.parser.find_next_segment_index.call(null,segments,idx,n,"ISA");
if((isa_idx < (0))){
return ranges;
} else {
var iea_idx = org.kp.kpmc.parser.find_next_segment_index.call(null,segments,(isa_idx + (1)),n,"IEA");
if((iea_idx < (0))){
return cljs.core.conj.call(null,ranges,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"start","start",-355208981),isa_idx,new cljs.core.Keyword(null,"end","end",-268185958),n], null));
} else {
var iea_end = (iea_idx + (1));
var G__2015 = iea_end;
var G__2016 = cljs.core.conj.call(null,ranges,new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"start","start",-355208981),isa_idx,new cljs.core.Keyword(null,"end","end",-268185958),iea_end], null));
idx = G__2015;
ranges = G__2016;
continue;
}
}
}
break;
}
});
/**
 * Return a single-line text preview for debug logging.
 */
org.kp.kpmc.parser.preview_text = (function org$kp$kpmc$parser$preview_text(s,n){
var v = (function (){var or__5142__auto__ = s;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})();
var limit = cljs.core.max.call(null,(0),(function (){var or__5142__auto__ = n;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (120);
}
})());
return clojure.string.replace.call(null,clojure.string.replace.call(null,cljs.core.subs.call(null,v,(0),cljs.core.min.call(null,limit,cljs.core.count.call(null,v))),/\r/,"\\r"),/\n/,"\\n");
});
/**
 * Split transaction body text into preamble and INS subscriber chunks.
 */
org.kp.kpmc.parser.split_trans_body_by_ins = (function org$kp$kpmc$parser$split_trans_body_by_ins(text){
var segments = org.kp.kpmc.parser.split_edi_segments.call(null,text);
var ins_indexes = cljs.core.vec.call(null,cljs.core.remove.call(null,cljs.core.nil_QMARK_,cljs.core.map_indexed.call(null,(function (idx,seg){
if(cljs.core._EQ_.call(null,"INS",org.kp.kpmc.parser.segment_id.call(null,seg))){
return idx;
} else {
return null;
}
}),segments)));
if(cljs.core.empty_QMARK_.call(null,ins_indexes)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"preamble-text","preamble-text",-1480702866),org.kp.kpmc.parser.segments__GT_edi_text.call(null,segments),new cljs.core.Keyword(null,"subscriber-texts","subscriber-texts",-1931319948),cljs.core.PersistentVector.EMPTY], null);
} else {
var head = cljs.core.first.call(null,ins_indexes);
var preamble = cljs.core.subvec.call(null,segments,(0),head);
var subscriber_texts = cljs.core.vec.call(null,cljs.core.remove.call(null,cljs.core.nil_QMARK_,cljs.core.map_indexed.call(null,(function (n,start){
var end = (function (){var or__5142__auto__ = cljs.core.nth.call(null,ins_indexes,(n + (1)),null);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.count.call(null,segments);
}
})();
return org.kp.kpmc.parser.segments__GT_edi_text.call(null,cljs.core.subvec.call(null,segments,start,end));
}),ins_indexes)));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"preamble-text","preamble-text",-1480702866),org.kp.kpmc.parser.segments__GT_edi_text.call(null,preamble),new cljs.core.Keyword(null,"subscriber-texts","subscriber-texts",-1931319948),subscriber_texts], null);
}
});
/**
 * Normalize INS parser output into a stable node shape for trans_body trees.
 */
org.kp.kpmc.parser.normalize_ins_node = (function org$kp$kpmc$parser$normalize_ins_node(node){
if(((cljs.core.sequential_QMARK_.call(null,node)) && (cljs.core._EQ_.call(null,cljs.core.first.call(null,node),new cljs.core.Keyword(null,"ins_subscriber","ins_subscriber",-1327973623))))){
return node;
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"ins_subscriber","ins_subscriber",-1327973623)], null),cljs.core.rest.call(null,node));
}
});
/**
 * Parse exactly one INS-started subscriber block without retaining other subscribers.
 */
org.kp.kpmc.parser.parse_ins_text = (function org$kp$kpmc$parser$parse_ins_text(var_args){
var G__2018 = arguments.length;
switch (G__2018) {
case 1:
return org.kp.kpmc.parser.parse_ins_text.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
case 2:
return org.kp.kpmc.parser.parse_ins_text.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.parser.parse_ins_text.cljs$core$IFn$_invoke$arity$1 = (function (text){
return org.kp.kpmc.parser.parse_ins_text.call(null,text,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.parser.parse_ins_text.cljs$core$IFn$_invoke$arity$2 = (function (text,opts){
var parser = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282).cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.parser.create_parsers.call(null));
}
})();
var parsed = parser.call(null,text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,parsed)){
throw cljs.core.ex_info.call(null,"INS subscriber parsing failed",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"ins-subscriber-parse-failed","ins-subscriber-parse-failed",-437216325),new cljs.core.Keyword(null,"failure","failure",720415879),parsed], null));
} else {
return org.kp.kpmc.parser.normalize_ins_node.call(null,parsed);
}
}));

(org.kp.kpmc.parser.parse_ins_text.cljs$lang$maxFixedArity = 2);

/**
 * Parse trans_body by preamble + INS subscriber chunks while keeping INS raw.
 */
org.kp.kpmc.parser.parse_trans_body_by_subscriber = (function org$kp$kpmc$parser$parse_trans_body_by_subscriber(trans_parser,ins_parser,text,opts){
var map__2020 = org.kp.kpmc.parser.split_trans_body_by_ins.call(null,text);
var map__2020__$1 = cljs.core.__destructure_map.call(null,map__2020);
var preamble_text = cljs.core.get.call(null,map__2020__$1,new cljs.core.Keyword(null,"preamble-text","preamble-text",-1480702866));
var subscriber_texts = cljs.core.get.call(null,map__2020__$1,new cljs.core.Keyword(null,"subscriber-texts","subscriber-texts",-1931319948));
var log_memory_QMARK_ = new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts);
var log_every = cljs.core.max.call(null,(1),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"log-every-n-subscribers","log-every-n-subscribers",-1814821737).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (100);
}
})());
var preamble_nodes = (cljs.core.truth_((function (){var and__5140__auto__ = preamble_text;
if(cljs.core.truth_(and__5140__auto__)){
return (!(clojure.string.blank_QMARK_.call(null,preamble_text)));
} else {
return and__5140__auto__;
}
})())?(function (){var parsed = trans_parser.call(null,preamble_text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,parsed)){
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"failure","failure",720415879),parsed], null);
} else {
return new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"nodes","nodes",-2099585805),cljs.core.vec.call(null,cljs.core.rest.call(null,parsed))], null);
}
})():new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"nodes","nodes",-2099585805),cljs.core.PersistentVector.EMPTY], null));
var temp__5823__auto__ = new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(preamble_nodes);
if(cljs.core.truth_(temp__5823__auto__)){
var failure = temp__5823__auto__;
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"trans-body-preamble-parse-failed","trans-body-preamble-parse-failed",581854475),new cljs.core.Keyword(null,"failure","failure",720415879),failure], null);
} else {
var remaining = subscriber_texts;
var idx = (0);
var acc = new cljs.core.Keyword(null,"nodes","nodes",-2099585805).cljs$core$IFn$_invoke$arity$1(preamble_nodes);
while(true){
if(cljs.core.empty_QMARK_.call(null,remaining)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_body","trans_body",-907422531)], null),acc),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),idx], null);
} else {
var subscriber_text = cljs.core.first.call(null,remaining);
var parsed = ins_parser.call(null,subscriber_text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if((((idx === (0))) || ((cljs.core.mod.call(null,idx,log_every) === (0))))){
org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-trans-body-by-subscriber",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),idx,new cljs.core.Keyword(null,"subscriber-count-total","subscriber-count-total",1860216688),cljs.core.count.call(null,subscriber_texts)], null));
} else {
}

if(instaparse.core.failure_QMARK_.call(null,parsed)){
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"ins-subscriber-parse-failed","ins-subscriber-parse-failed",-437216325),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),idx,new cljs.core.Keyword(null,"failure","failure",720415879),parsed,new cljs.core.Keyword(null,"subscriber-text","subscriber-text",1423894457),subscriber_text], null);
} else {
var nodes = new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"segment_or_loop","segment_or_loop",-1613973562),org.kp.kpmc.parser.normalize_ins_node.call(null,parsed)], null)], null);
var G__2021 = cljs.core.rest.call(null,remaining);
var G__2022 = (idx + (1));
var G__2023 = cljs.core.into.call(null,acc,nodes);
remaining = G__2021;
idx = G__2022;
acc = G__2023;
continue;
}
}
break;
}
}
});
/**
 * Parse a full sample X12 file with the monolithic grammar.
 */
org.kp.kpmc.parser.testX12 = (function org$kp$kpmc$parser$testX12(){
var sample = org.kp.kpmc.io_node.read_text.call(null,"src/main/resources/edisamples/cityofatlanta_834_ga_20250831072309223.txt");
var parse_result = org.kp.kpmc.parser.x12_parser.call(null,sample,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"failure","failure",720415879),instaparse.core.failure_QMARK_.call(null,parse_result),new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),parse_result], null);
});
/**
 * Stage 1: Parse with x12_x12_file.ebnf to extract outer envelope.
 */
org.kp.kpmc.parser.testX12_stage1 = (function org$kp$kpmc$parser$testX12_stage1(){
var sample = org.kp.kpmc.io_node.read_text.call(null,"src/main/resources/edisamples/test1.txt");
var parse_result = org.kp.kpmc.parser.envelope_parser.call(null,sample,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"stage","stage",1843544772),(1),new cljs.core.Keyword(null,"description","description",-1428560544),"Outer envelope parsing (ISA/GS/IEA)",new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),parse_result,new cljs.core.Keyword(null,"failure","failure",720415879),instaparse.core.failure_QMARK_.call(null,parse_result),new cljs.core.Keyword(null,"sample-length","sample-length",1943200126),cljs.core.count.call(null,sample),new cljs.core.Keyword(null,"sample-preview","sample-preview",-336040651),cljs.core.subs.call(null,sample,(0),cljs.core.min.call(null,(200),cljs.core.count.call(null,sample)))], null);
});
/**
 * Stage 2: Parse function_body with x12_function_body.ebnf.
 */
org.kp.kpmc.parser.testX12_stage2 = (function org$kp$kpmc$parser$testX12_stage2(stage1_result){
if(cljs.core.truth_(new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(stage1_result))){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"stage","stage",1843544772),(2),new cljs.core.Keyword(null,"error","error",-978969032),"Stage 1 failed",new cljs.core.Keyword(null,"stage1-failure","stage1-failure",1904856711),new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(stage1_result)], null);
} else {
var input_text = org.kp.kpmc.io_node.read_text.call(null,"src/main/resources/edisamples/cityofatlanta_834_ga_20250831072309223.txt");
var parse_tree = new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(stage1_result);
var fg_tree = org.kp.kpmc.parser.find_in_parse_tree.call(null,parse_tree,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539));
var fg_span = (cljs.core.truth_(fg_tree)?instaparse.core.span.call(null,fg_tree):null);
var fg_text = (cljs.core.truth_(fg_span)?org.kp.kpmc.parser.extract_text_by_span.call(null,input_text,fg_span):null);
var parse_result = (cljs.core.truth_(fg_text)?org.kp.kpmc.parser.function_body_parser.call(null,fg_text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430)):null);
return new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"stage","stage",1843544772),(2),new cljs.core.Keyword(null,"description","description",-1428560544),"Function body parsing (ST/SE transaction sets)",new cljs.core.Keyword(null,"functional-group-span","functional-group-span",1494301428),fg_span,new cljs.core.Keyword(null,"functional-group-text-preview","functional-group-text-preview",558741350),(cljs.core.truth_(fg_text)?cljs.core.subs.call(null,fg_text,(0),cljs.core.min.call(null,(200),((fg_text).length))):null),new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),parse_result,new cljs.core.Keyword(null,"failure","failure",720415879),(function (){var and__5140__auto__ = parse_result;
if(cljs.core.truth_(and__5140__auto__)){
return instaparse.core.failure_QMARK_.call(null,parse_result);
} else {
return and__5140__auto__;
}
})(),new cljs.core.Keyword(null,"parse-found","parse-found",-180361135),(!((parse_result == null)))], null);
}
});
/**
 * Stage 3: Parse each trans_body with x12_trans_body.ebnf.
 */
org.kp.kpmc.parser.testX12_stage3 = (function org$kp$kpmc$parser$testX12_stage3(stage2_result){
if(cljs.core.truth_((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(stage2_result);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.not.call(null,new cljs.core.Keyword(null,"parse-found","parse-found",-180361135).cljs$core$IFn$_invoke$arity$1(stage2_result));
}
})())){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"stage","stage",1843544772),(3),new cljs.core.Keyword(null,"error","error",-978969032),"Stage 2 failed or no parse tree found",new cljs.core.Keyword(null,"stage2-info","stage2-info",-862127476),stage2_result], null);
} else {
var parse_tree = new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(stage2_result);
var input_text = org.kp.kpmc.io_node.read_text.call(null,"src/main/resources/edisamples/cityofatlanta_834_ga_20250831072309223.txt");
var find_all_trans_sets = (function org$kp$kpmc$parser$testX12_stage3_$_find_trans_sets(tree){
if((!(cljs.core.sequential_QMARK_.call(null,tree)))){
return cljs.core.PersistentVector.EMPTY;
} else {
if(cljs.core._EQ_.call(null,cljs.core.first.call(null,tree),new cljs.core.Keyword(null,"transaction-set","transaction-set",1665838369))){
return new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [tree], null);
} else {
return cljs.core.mapcat.call(null,org$kp$kpmc$parser$testX12_stage3_$_find_trans_sets,cljs.core.rest.call(null,tree));

}
}
});
var trans_sets = find_all_trans_sets.call(null,parse_tree);
var parsed_bodies = cljs.core.map_indexed.call(null,(function (idx,trans_set){
var trans_body = org.kp.kpmc.parser.find_in_parse_tree.call(null,trans_set,new cljs.core.Keyword(null,"trans-body","trans-body",1699605592));
var trans_body_span = (cljs.core.truth_(trans_body)?instaparse.core.span.call(null,trans_body):null);
var trans_body_text = (cljs.core.truth_(trans_body_span)?org.kp.kpmc.parser.extract_text_by_span.call(null,input_text,trans_body_span):null);
var parse_result = (cljs.core.truth_(trans_body_text)?org.kp.kpmc.parser.trans_body_parser.call(null,trans_body_text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430)):null);
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"transaction-set-index","transaction-set-index",-491853587),idx,new cljs.core.Keyword(null,"trans-body-span","trans-body-span",-125249838),trans_body_span,new cljs.core.Keyword(null,"trans-body-text-preview","trans-body-text-preview",999982826),(cljs.core.truth_(trans_body_text)?cljs.core.subs.call(null,trans_body_text,(0),cljs.core.min.call(null,(100),((trans_body_text).length))):null),new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),parse_result,new cljs.core.Keyword(null,"failure","failure",720415879),(function (){var and__5140__auto__ = parse_result;
if(cljs.core.truth_(and__5140__auto__)){
return instaparse.core.failure_QMARK_.call(null,parse_result);
} else {
return and__5140__auto__;
}
})()], null);
}),trans_sets);
return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"stage","stage",1843544772),(3),new cljs.core.Keyword(null,"description","description",-1428560544),"Transaction body parsing (detailed data segments)",new cljs.core.Keyword(null,"transaction-set-count","transaction-set-count",-129006399),cljs.core.count.call(null,trans_sets),new cljs.core.Keyword(null,"parsed-bodies","parsed-bodies",-220667811),parsed_bodies,new cljs.core.Keyword(null,"all-success","all-success",-62759992),cljs.core.every_QMARK_.call(null,(function (p1__2024_SHARP_){
return cljs.core.not.call(null,new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(p1__2024_SHARP_));
}),parsed_bodies)], null);
}
});
/**
 * Orchestrate multi-stage hierarchical parsing and return stage results.
 */
org.kp.kpmc.parser.testX12_hierarchical = (function org$kp$kpmc$parser$testX12_hierarchical(){
var stage1 = org.kp.kpmc.parser.testX12_stage1.call(null);
var stage2 = org.kp.kpmc.parser.testX12_stage2.call(null,stage1);
var stage3 = org.kp.kpmc.parser.testX12_stage3.call(null,stage2);
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"stage1","stage1",882778990),stage1,new cljs.core.Keyword(null,"stage2","stage2",2131003428),stage2,new cljs.core.Keyword(null,"stage3","stage3",-2012275741),stage3,new cljs.core.Keyword(null,"summary","summary",380847952),new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"stages-completed","stages-completed",-1657098054),(3),new cljs.core.Keyword(null,"stage1-success","stage1-success",706718032),cljs.core.not.call(null,new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(stage1)),new cljs.core.Keyword(null,"stage2-success","stage2-success",1350552915),cljs.core.not.call(null,new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(stage2)),new cljs.core.Keyword(null,"stage3-success","stage3-success",-156546022),((cljs.core.contains_QMARK_.call(null,stage3,new cljs.core.Keyword(null,"all-success","all-success",-62759992)))?new cljs.core.Keyword(null,"all-success","all-success",-62759992).cljs$core$IFn$_invoke$arity$1(stage3):null)], null)], null);
});
/**
 * Stage 1: Parse X12 envelope structure (ISA/GS/GE/IEA).
 */
org.kp.kpmc.parser.parse_envelope = (function org$kp$kpmc$parser$parse_envelope(parser,input_text){
var result = parser.call(null,input_text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,result)){
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"envelope-parse-failed","envelope-parse-failed",-1815576673),new cljs.core.Keyword(null,"failure","failure",720415879),result], null);
} else {
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),result,new cljs.core.Keyword(null,"input-text","input-text",-1336297114),input_text], null);
}
});
/**
 * Extract all function_body text blobs from envelope parse result.
 */
org.kp.kpmc.parser.extract_function_bodies = (function org$kp$kpmc$parser$extract_function_bodies(envelope_result){
if(cljs.core.truth_(new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(envelope_result))){
var input_text = new cljs.core.Keyword(null,"input-text","input-text",-1336297114).cljs$core$IFn$_invoke$arity$1(envelope_result);
var parse_tree = new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(envelope_result);
var func_groups = org.kp.kpmc.parser.find_all_nodes.call(null,parse_tree,new cljs.core.Keyword(null,"functional_group","functional_group",1799340978));
var iter__5628__auto__ = (function org$kp$kpmc$parser$extract_function_bodies_$_iter__2025(s__2026){
return (new cljs.core.LazySeq(null,(function (){
var s__2026__$1 = s__2026;
while(true){
var temp__5825__auto__ = cljs.core.seq.call(null,s__2026__$1);
if(temp__5825__auto__){
var s__2026__$2 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,s__2026__$2)){
var c__5626__auto__ = cljs.core.chunk_first.call(null,s__2026__$2);
var size__5627__auto__ = cljs.core.count.call(null,c__5626__auto__);
var b__2028 = cljs.core.chunk_buffer.call(null,size__5627__auto__);
if((function (){var i__2027 = (0);
while(true){
if((i__2027 < size__5627__auto__)){
var fg = cljs.core._nth.call(null,c__5626__auto__,i__2027);
var fb = org.kp.kpmc.parser.find_in_parse_tree.call(null,fg,new cljs.core.Keyword(null,"function_body","function_body",1179053955));
var span = (cljs.core.truth_(fb)?instaparse.core.span.call(null,fb):null);
var text = (cljs.core.truth_(fb)?org.kp.kpmc.parser.function_body_node__GT_text.call(null,input_text,fb):null);
if(cljs.core.truth_(text)){
cljs.core.chunk_append.call(null,b__2028,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879),text,new cljs.core.Keyword(null,"span","span",1394872991),span,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539),fg], null));

var G__2029 = (i__2027 + (1));
i__2027 = G__2029;
continue;
} else {
var G__2030 = (i__2027 + (1));
i__2027 = G__2030;
continue;
}
} else {
return true;
}
break;
}
})()){
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__2028),org$kp$kpmc$parser$extract_function_bodies_$_iter__2025.call(null,cljs.core.chunk_rest.call(null,s__2026__$2)));
} else {
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__2028),null);
}
} else {
var fg = cljs.core.first.call(null,s__2026__$2);
var fb = org.kp.kpmc.parser.find_in_parse_tree.call(null,fg,new cljs.core.Keyword(null,"function_body","function_body",1179053955));
var span = (cljs.core.truth_(fb)?instaparse.core.span.call(null,fb):null);
var text = (cljs.core.truth_(fb)?org.kp.kpmc.parser.function_body_node__GT_text.call(null,input_text,fb):null);
if(cljs.core.truth_(text)){
return cljs.core.cons.call(null,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879),text,new cljs.core.Keyword(null,"span","span",1394872991),span,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539),fg], null),org$kp$kpmc$parser$extract_function_bodies_$_iter__2025.call(null,cljs.core.rest.call(null,s__2026__$2)));
} else {
var G__2031 = cljs.core.rest.call(null,s__2026__$2);
s__2026__$1 = G__2031;
continue;
}
}
} else {
return null;
}
break;
}
}),null,null));
});
return iter__5628__auto__.call(null,func_groups);
} else {
return null;
}
});
/**
 * Extract function body blobs by scanning ISA/IEA then GS/GE boundaries.
 *   This avoids building a full Instaparse envelope tree in chunked mode.
 */
org.kp.kpmc.parser.extract_function_bodies_lite = (function org$kp$kpmc$parser$extract_function_bodies_lite(input_text){
var segments = org.kp.kpmc.parser.split_edi_segments.call(null,input_text);
var isa_ranges = org.kp.kpmc.parser.split_segments_by_isa.call(null,segments);
return cljs.core.reduce.call(null,(function (groups,p__2032){
var map__2033 = p__2032;
var map__2033__$1 = cljs.core.__destructure_map.call(null,map__2033);
var start = cljs.core.get.call(null,map__2033__$1,new cljs.core.Keyword(null,"start","start",-355208981));
var end = cljs.core.get.call(null,map__2033__$1,new cljs.core.Keyword(null,"end","end",-268185958));
var idx = start;
var acc = groups;
while(true){
if((idx >= end)){
return acc;
} else {
var seg = cljs.core.nth.call(null,segments,idx);
var sid = org.kp.kpmc.parser.segment_id.call(null,seg);
if(cljs.core._EQ_.call(null,sid,"GS")){
var ge_idx = org.kp.kpmc.parser.find_next_segment_index.call(null,segments,(idx + (1)),end,"GE");
if((ge_idx < (0))){
var G__2034 = (idx + (1));
var G__2035 = acc;
idx = G__2034;
acc = G__2035;
continue;
} else {
var body_segments = cljs.core.subvec.call(null,segments,(idx + (1)),ge_idx);
var body_text = org.kp.kpmc.parser.segments__GT_edi_text.call(null,body_segments);
var fg_node = new cljs.core.PersistentVector(null, 4, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"functional_group","functional_group",1799340978),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"function_header","function_header",-45502077),seg], null),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"function_body","function_body",1179053955),body_text], null),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"function_trailer","function_trailer",1638839361),cljs.core.nth.call(null,segments,ge_idx)], null)], null);
var G__2036 = (ge_idx + (1));
var G__2037 = (cljs.core.truth_(body_text)?cljs.core.conj.call(null,acc,new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879),body_text,new cljs.core.Keyword(null,"span","span",1394872991),null,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539),fg_node], null)):acc);
idx = G__2036;
acc = G__2037;
continue;
}
} else {
var G__2038 = (idx + (1));
var G__2039 = acc;
idx = G__2038;
acc = G__2039;
continue;
}
}
break;
}
}),cljs.core.PersistentVector.EMPTY,isa_ranges);
});
/**
 * Stage 2: Parse a single function_body to extract transaction sets.
 */
org.kp.kpmc.parser.parse_function_body = (function org$kp$kpmc$parser$parse_function_body(parser,func_body_info){
var text = new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879).cljs$core$IFn$_invoke$arity$1(func_body_info);
var result = parser.call(null,text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,result)){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"function-body-parse-failed","function-body-parse-failed",-1460730595),new cljs.core.Keyword(null,"failure","failure",720415879),result,new cljs.core.Keyword(null,"input","input",556931961),func_body_info], null);
} else {
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),result,new cljs.core.Keyword(null,"text","text",-1790561697),text,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539),new cljs.core.Keyword(null,"functional-group","functional-group",1632056539).cljs$core$IFn$_invoke$arity$1(func_body_info)], null);
}
});
/**
 * Extract transaction set info from parsed function body.
 */
org.kp.kpmc.parser.extract_transaction_sets = (function org$kp$kpmc$parser$extract_transaction_sets(func_body_result){
if(cljs.core.truth_(new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(func_body_result))){
var text = new cljs.core.Keyword(null,"text","text",-1790561697).cljs$core$IFn$_invoke$arity$1(func_body_result);
var parse_tree = new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(func_body_result);
var trans_sets = org.kp.kpmc.parser.find_all_nodes.call(null,parse_tree,new cljs.core.Keyword(null,"transaction_set","transaction_set",-906308203));
return cljs.core.map_indexed.call(null,(function (idx,ts){
var header = org.kp.kpmc.parser.find_in_parse_tree.call(null,ts,new cljs.core.Keyword(null,"trans_set_header","trans_set_header",-1079013849));
var trailer = org.kp.kpmc.parser.find_in_parse_tree.call(null,ts,new cljs.core.Keyword(null,"trans_set_trailer","trans_set_trailer",-1537804660));
var body = org.kp.kpmc.parser.find_in_parse_tree.call(null,ts,new cljs.core.Keyword(null,"trans_body","trans_body",-907422531));
var span = (cljs.core.truth_(body)?instaparse.core.span.call(null,body):null);
var body_text = (cljs.core.truth_(body)?org.kp.kpmc.parser.raw_segment_node__GT_text.call(null,text,body):null);
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"index","index",-1531685915),idx,new cljs.core.Keyword(null,"header","header",119441134),header,new cljs.core.Keyword(null,"trailer","trailer",-1354572924),trailer,new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879),body_text,new cljs.core.Keyword(null,"span","span",1394872991),span,new cljs.core.Keyword(null,"transaction-set","transaction-set",1665838369),ts], null);
}),trans_sets);
} else {
return null;
}
});
/**
 * Extract ST/SE transaction sets from a function body text blob.
 *  Transaction body is kept as raw text for the next parser stage.
 */
org.kp.kpmc.parser.extract_transaction_sets_lite = (function org$kp$kpmc$parser$extract_transaction_sets_lite(func_body_info){
var text = new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879).cljs$core$IFn$_invoke$arity$1(func_body_info);
var segments = org.kp.kpmc.parser.split_edi_segments.call(null,(function (){var or__5142__auto__ = text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
var n = cljs.core.count.call(null,segments);
var idx = (0);
var tx_idx = (0);
var out = cljs.core.PersistentVector.EMPTY;
while(true){
if((idx >= n)){
return out;
} else {
var seg = cljs.core.nth.call(null,segments,idx);
var sid = org.kp.kpmc.parser.segment_id.call(null,seg);
if(cljs.core._EQ_.call(null,sid,"ST")){
var se_idx = org.kp.kpmc.parser.find_next_segment_index.call(null,segments,(idx + (1)),n,"SE");
if((se_idx < (0))){
var G__2040 = (idx + (1));
var G__2041 = tx_idx;
var G__2042 = out;
idx = G__2040;
tx_idx = G__2041;
out = G__2042;
continue;
} else {
var body_segments = cljs.core.subvec.call(null,segments,(idx + (1)),se_idx);
var body_text = org.kp.kpmc.parser.segments__GT_edi_text.call(null,body_segments);
var G__2043 = (se_idx + (1));
var G__2044 = (tx_idx + (1));
var G__2045 = cljs.core.conj.call(null,out,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"index","index",-1531685915),tx_idx,new cljs.core.Keyword(null,"header","header",119441134),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_set_header","trans_set_header",-1079013849),seg], null),new cljs.core.Keyword(null,"trailer","trailer",-1354572924),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"trans_set_trailer","trans_set_trailer",-1537804660),cljs.core.nth.call(null,segments,se_idx)], null),new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879),body_text,new cljs.core.Keyword(null,"span","span",1394872991),null,new cljs.core.Keyword(null,"transaction-set","transaction-set",1665838369),null], null));
idx = G__2043;
tx_idx = G__2044;
out = G__2045;
continue;
}
} else {
var G__2046 = (idx + (1));
var G__2047 = tx_idx;
var G__2048 = out;
idx = G__2046;
tx_idx = G__2047;
out = G__2048;
continue;
}
}
break;
}
});
/**
 * Stage 3: Parse a single transaction body into detailed segments.
 */
org.kp.kpmc.parser.parse_trans_body = (function org$kp$kpmc$parser$parse_trans_body(parser,ins_parser,trans_set_info,opts){
var temp__5823__auto__ = new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879).cljs$core$IFn$_invoke$arity$1(trans_set_info);
if(cljs.core.truth_(temp__5823__auto__)){
var text = temp__5823__auto__;
var result = (cljs.core.truth_(ins_parser)?org.kp.kpmc.parser.parse_trans_body_by_subscriber.call(null,parser,ins_parser,text,opts):(function (){var parsed = parser.call(null,text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,parsed)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"failure","failure",720415879),parsed], null);
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),parsed], null);
}
})());
if(cljs.core.truth_(new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(result))){
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"parse_tree","parse_tree",1734394514),new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"index","index",-1531685915),new cljs.core.Keyword(null,"index","index",-1531685915).cljs$core$IFn$_invoke$arity$1(trans_set_info),new cljs.core.Keyword(null,"header","header",119441134),new cljs.core.Keyword(null,"header","header",119441134).cljs$core$IFn$_invoke$arity$1(trans_set_info),new cljs.core.Keyword(null,"trailer","trailer",-1354572924),new cljs.core.Keyword(null,"trailer","trailer",-1354572924).cljs$core$IFn$_invoke$arity$1(trans_set_info),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"subscriber_count","subscriber_count",1156880152),new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(result)], null);
} else {
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"error","error",-978969032),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(result);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return new cljs.core.Keyword(null,"trans-body-parse-failed","trans-body-parse-failed",-1630752312);
}
})(),new cljs.core.Keyword(null,"failure","failure",720415879),new cljs.core.Keyword(null,"failure","failure",720415879).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"subscriber_index","subscriber_index",1687954946),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903).cljs$core$IFn$_invoke$arity$1(result),new cljs.core.Keyword(null,"index","index",-1531685915),new cljs.core.Keyword(null,"index","index",-1531685915).cljs$core$IFn$_invoke$arity$1(trans_set_info),new cljs.core.Keyword(null,"header","header",119441134),new cljs.core.Keyword(null,"header","header",119441134).cljs$core$IFn$_invoke$arity$1(trans_set_info),new cljs.core.Keyword(null,"trailer","trailer",-1354572924),new cljs.core.Keyword(null,"trailer","trailer",-1354572924).cljs$core$IFn$_invoke$arity$1(trans_set_info)], null);
}
} else {
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"no-trans-body-text","no-trans-body-text",825725515),new cljs.core.Keyword(null,"index","index",-1531685915),new cljs.core.Keyword(null,"index","index",-1531685915).cljs$core$IFn$_invoke$arity$1(trans_set_info)], null);
}
});
/**
 * Parse X12 file in chunks for memory efficiency.
 */
org.kp.kpmc.parser.parse_x12_chunked = (function org$kp$kpmc$parser$parse_x12_chunked(var_args){
var G__2051 = arguments.length;
switch (G__2051) {
case 1:
return org.kp.kpmc.parser.parse_x12_chunked.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
case 2:
return org.kp.kpmc.parser.parse_x12_chunked.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.parser.parse_x12_chunked.cljs$core$IFn$_invoke$arity$1 = (function (filepath){
return org.kp.kpmc.parser.parse_x12_chunked.call(null,filepath,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.parser.parse_x12_chunked.cljs$core$IFn$_invoke$arity$2 = (function (filepath,opts){
var parsers = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"parsers","parsers",-804353827).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.parser.create_parsers.call(null);
}
})();
var map__2052 = parsers;
var map__2052__$1 = cljs.core.__destructure_map.call(null,map__2052);
var envelope_parser = cljs.core.get.call(null,map__2052__$1,new cljs.core.Keyword(null,"envelope-parser","envelope-parser",-814202825));
var function_body_parser = cljs.core.get.call(null,map__2052__$1,new cljs.core.Keyword(null,"function-body-parser","function-body-parser",1142718853));
var trans_body_parser = cljs.core.get.call(null,map__2052__$1,new cljs.core.Keyword(null,"trans-body-parser","trans-body-parser",139234072));
var ins_parser = cljs.core.get.call(null,map__2052__$1,new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282));
var input_text = org.kp.kpmc.io_node.read_text.call(null,filepath);
var on_tx = new cljs.core.Keyword(null,"on-transaction","on-transaction",515595557).cljs$core$IFn$_invoke$arity$1(opts);
var log_memory_QMARK_ = new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts);
var lightweight_QMARK_ = (!(new cljs.core.Keyword(null,"lightweight-chunked?","lightweight-chunked?",-1815918587).cljs$core$IFn$_invoke$arity$1(opts) === false));
var _ = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-chunked:start",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"file","file",-1269645878),filepath,new cljs.core.Keyword(null,"file-size","file-size",-1900760755),cljs.core.count.call(null,input_text)], null));
var envelope_result = ((lightweight_QMARK_)?null:org.kp.kpmc.parser.parse_envelope.call(null,envelope_parser,input_text));
var ___$1 = (((((!(lightweight_QMARK_))) && (cljs.core.not.call(null,new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(envelope_result)))))?(function(){throw cljs.core.ex_info.call(null,"Envelope parsing failed",envelope_result)})():null);
var ___$2 = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-chunked:after-envelope",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"lightweight-chunked","lightweight-chunked",1808365441),lightweight_QMARK_], null));
var func_bodies = ((lightweight_QMARK_)?org.kp.kpmc.parser.extract_function_bodies_lite.call(null,input_text):org.kp.kpmc.parser.extract_function_bodies.call(null,envelope_result));
var process_transaction = (function (trans_set_info){
var parsed = org.kp.kpmc.parser.parse_trans_body.call(null,trans_body_parser,ins_parser,trans_set_info,opts);
if(cljs.core.truth_(on_tx)){
on_tx.call(null,parsed);
} else {
}

return parsed;
});
var process_func_group = (function (fb_info){
if(lightweight_QMARK_){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539),new cljs.core.Keyword(null,"functional-group","functional-group",1632056539).cljs$core$IFn$_invoke$arity$1(fb_info),new cljs.core.Keyword(null,"functional_group","functional_group",1799340978),new cljs.core.Keyword(null,"functional-group","functional-group",1632056539).cljs$core$IFn$_invoke$arity$1(fb_info),new cljs.core.Keyword(null,"transactions","transactions",-1425846118),cljs.core.map.call(null,process_transaction,org.kp.kpmc.parser.extract_transaction_sets_lite.call(null,fb_info))], null);
} else {
var fb_result = org.kp.kpmc.parser.parse_function_body.call(null,function_body_parser,fb_info);
if(cljs.core.truth_(new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(fb_result))){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"functional-group","functional-group",1632056539),new cljs.core.Keyword(null,"functional-group","functional-group",1632056539).cljs$core$IFn$_invoke$arity$1(fb_info),new cljs.core.Keyword(null,"functional_group","functional_group",1799340978),new cljs.core.Keyword(null,"functional-group","functional-group",1632056539).cljs$core$IFn$_invoke$arity$1(fb_info),new cljs.core.Keyword(null,"transactions","transactions",-1425846118),cljs.core.map.call(null,process_transaction,org.kp.kpmc.parser.extract_transaction_sets.call(null,fb_result))], null);
} else {
return fb_result;
}
}
});
var func_group_results = (cljs.core.truth_(new cljs.core.Keyword(null,"lazy?","lazy?",2035907855).cljs$core$IFn$_invoke$arity$1(opts))?cljs.core.map.call(null,process_func_group,func_bodies):cljs.core.doall.call(null,cljs.core.map.call(null,process_func_group,func_bodies)));
var ___$3 = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-chunked:after-functional-groups",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"functional-group-count","functional-group-count",-818500858),cljs.core.count.call(null,func_bodies)], null));
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"envelope","envelope",-236796318),(cljs.core.truth_(envelope_result)?new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(envelope_result):null),new cljs.core.Keyword(null,"functional-groups","functional-groups",-1984154067),func_group_results,new cljs.core.Keyword(null,"functional_groups","functional_groups",1271755517),func_group_results,new cljs.core.Keyword(null,"summary","summary",380847952),new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"file","file",-1269645878),filepath,new cljs.core.Keyword(null,"file-size","file-size",-1900760755),cljs.core.count.call(null,input_text),new cljs.core.Keyword(null,"functional-group-count","functional-group-count",-818500858),cljs.core.count.call(null,func_bodies),new cljs.core.Keyword(null,"functional_group_count","functional_group_count",1021790426),cljs.core.count.call(null,func_bodies),new cljs.core.Keyword(null,"lightweight-chunked","lightweight-chunked",1808365441),lightweight_QMARK_,new cljs.core.Keyword(null,"total-transactions","total-transactions",1543627798),cljs.core.reduce.call(null,cljs.core._PLUS_,(0),cljs.core.map.call(null,(function (p1__2049_SHARP_){
return cljs.core.count.call(null,new cljs.core.Keyword(null,"transactions","transactions",-1425846118).cljs$core$IFn$_invoke$arity$1(p1__2049_SHARP_));
}),cljs.core.filter.call(null,new cljs.core.Keyword(null,"success","success",1890645906),func_group_results)))], null)], null);
}));

(org.kp.kpmc.parser.parse_x12_chunked.cljs$lang$maxFixedArity = 2);

/**
 * Parse test file and return chunked parsing result.
 */
org.kp.kpmc.parser.test_chunked_parse = (function org$kp$kpmc$parser$test_chunked_parse(){
return org.kp.kpmc.parser.parse_x12_chunked.call(null,"src/main/resources/edisamples/test1.txt");
});
/**
 * Parse X12 file through all 3 stages and return unified parse tree.
 */
org.kp.kpmc.parser.parse_x12_full = (function org$kp$kpmc$parser$parse_x12_full(var_args){
var G__2056 = arguments.length;
switch (G__2056) {
case 1:
return org.kp.kpmc.parser.parse_x12_full.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
case 2:
return org.kp.kpmc.parser.parse_x12_full.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.parser.parse_x12_full.cljs$core$IFn$_invoke$arity$1 = (function (filepath){
cljs.core.println.call(null,"reality checkino.........");

return org.kp.kpmc.parser.parse_x12_full.call(null,filepath,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.parser.parse_x12_full.cljs$core$IFn$_invoke$arity$2 = (function (filepath,opts){
cljs.core.println.call(null,"reality checkaufo.........");

var parsers = (function (){var or__5142__auto__ = new cljs.core.Keyword(null,"parsers","parsers",-804353827).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.parser.create_parsers.call(null);
}
})();
var map__2057 = parsers;
var map__2057__$1 = cljs.core.__destructure_map.call(null,map__2057);
var envelope_parser = cljs.core.get.call(null,map__2057__$1,new cljs.core.Keyword(null,"envelope-parser","envelope-parser",-814202825));
var function_body_parser = cljs.core.get.call(null,map__2057__$1,new cljs.core.Keyword(null,"function-body-parser","function-body-parser",1142718853));
var trans_body_parser = cljs.core.get.call(null,map__2057__$1,new cljs.core.Keyword(null,"trans-body-parser","trans-body-parser",139234072));
var ins_parser = cljs.core.get.call(null,map__2057__$1,new cljs.core.Keyword(null,"ins-parser","ins-parser",1475274282));
var log_memory_QMARK_ = new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts);
var supplied_text = new cljs.core.Keyword(null,"input-text","input-text",-1336297114).cljs$core$IFn$_invoke$arity$1(opts);
var _ = (cljs.core.truth_(supplied_text)?null:org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-full:before-file-read",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"file","file",-1269645878),filepath], null)));
var input_text = (function (){var or__5142__auto__ = supplied_text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.io_node.read_text.call(null,filepath);
}
})();
var lite_func_bodies = org.kp.kpmc.parser.extract_function_bodies_lite.call(null,input_text);
var fb_index_STAR_ = cljs.core.atom.call(null,(-1));
var input_segments = org.kp.kpmc.parser.split_edi_segments.call(null,input_text);
var ___$1 = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-full:after-file-read",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"file","file",-1269645878),filepath,new cljs.core.Keyword(null,"file-size","file-size",-1900760755),cljs.core.count.call(null,input_text),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.count.call(null,input_segments)], null));
var ___$2 = cljs.core.println.call(null,(""+"[diag] parse-x12-full file="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(filepath)+" segments="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,input_segments))+" lite-fgs="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,lite_func_bodies))));
var envelope = org.kp.kpmc.parser.parse_envelope.call(null,envelope_parser,input_text);
var ___$3 = (cljs.core.truth_(new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(envelope))?null:(function(){throw cljs.core.ex_info.call(null,"Envelope parsing failed",envelope)})());
var ___$4 = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-full:after-envelope",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"success","success",1890645906),true], null));
var replace_node = (function org$kp$kpmc$parser$replace_node(tree,tag,replacement_fn){
if((!(cljs.core.sequential_QMARK_.call(null,tree)))){
return tree;
} else {
if(cljs.core._EQ_.call(null,cljs.core.first.call(null,tree),tag)){
return replacement_fn.call(null,tree);
} else {
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.first.call(null,tree)], null),cljs.core.map.call(null,(function (p1__2054_SHARP_){
return org$kp$kpmc$parser$replace_node.call(null,p1__2054_SHARP_,tag,replacement_fn);
}),cljs.core.rest.call(null,tree)));

}
}
});
var expand_function_body = (function (fb_node){
var fb_index = cljs.core.swap_BANG_.call(null,fb_index_STAR_,cljs.core.inc);
var scanned_text = new cljs.core.Keyword(null,"trans-body-text","trans-body-text",653792879).cljs$core$IFn$_invoke$arity$1(cljs.core.nth.call(null,lite_func_bodies,fb_index,null));
var raw_text = (((((cljs.core.count.call(null,fb_node) > (1))) && (typeof cljs.core.second.call(null,fb_node) === 'string')))?cljs.core.second.call(null,fb_node):null);
var source = (cljs.core.truth_(scanned_text)?"scan-gs-ge":(cljs.core.truth_(raw_text)?"stage1-node":"raw-segment-fallback"
));
var text = (function (){var or__5142__auto__ = scanned_text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
var or__5142__auto____$1 = raw_text;
if(cljs.core.truth_(or__5142__auto____$1)){
return or__5142__auto____$1;
} else {
return org.kp.kpmc.parser.function_body_node__GT_text.call(null,input_text,fb_node);
}
}
})();
cljs.core.println.call(null,(""+"[diag] stage2 fb#"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(fb_index)+" source="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(source)+" scanned-len="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,(function (){var or__5142__auto__ = scanned_text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))+" raw-len="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,(function (){var or__5142__auto__ = raw_text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))+" chosen-len="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,(function (){var or__5142__auto__ = text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))));

if(cljs.core.truth_((function (){var and__5140__auto__ = text;
if(cljs.core.truth_(and__5140__auto__)){
return (!(clojure.string.blank_QMARK_.call(null,text)));
} else {
return and__5140__auto__;
}
})())){
var body_segments = org.kp.kpmc.parser.split_edi_segments.call(null,text);
var first_ids = clojure.string.join.call(null,",",cljs.core.map.call(null,org.kp.kpmc.parser.segment_id,cljs.core.take.call(null,(6),body_segments)));
var ___$5 = cljs.core.println.call(null,(""+"[diag] stage2 fb#"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(fb_index)+" first-ids="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(first_ids)+" preview='"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.parser.preview_text.call(null,text,(140)))+"'"));
var parsed = function_body_parser.call(null,text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,parsed)){
cljs.core.println.call(null,(""+"[diag] stage2 fb#"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(fb_index)+" parse=failure"));

return fb_node;
} else {
var tx_count = cljs.core.count.call(null,org.kp.kpmc.parser.find_all_nodes.call(null,parsed,new cljs.core.Keyword(null,"transaction_set","transaction_set",-906308203)));
cljs.core.println.call(null,(""+"[diag] stage2 fb#"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(fb_index)+" parse=ok tx-count="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(tx_count)));

return parsed;
}
} else {
return fb_node;
}
});
var expand_trans_body = (function (tb_node){
var raw_text = (((((cljs.core.count.call(null,tb_node) > (1))) && (typeof cljs.core.second.call(null,tb_node) === 'string')))?cljs.core.second.call(null,tb_node):null);
var text = (function (){var or__5142__auto__ = raw_text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return org.kp.kpmc.parser.raw_segment_node__GT_text.call(null,input_text,tb_node);
}
})();
cljs.core.println.call(null,(""+"[diag] stage3 trans-body raw-len="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,(function (){var or__5142__auto__ = raw_text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))+" chosen-len="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.count.call(null,(function (){var or__5142__auto__ = text;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})()))));

if(cljs.core.truth_((function (){var and__5140__auto__ = text;
if(cljs.core.truth_(and__5140__auto__)){
return (!(clojure.string.blank_QMARK_.call(null,text)));
} else {
return and__5140__auto__;
}
})())){
var tb_segments = org.kp.kpmc.parser.split_edi_segments.call(null,text);
var first_ids = clojure.string.join.call(null,",",cljs.core.map.call(null,org.kp.kpmc.parser.segment_id,cljs.core.take.call(null,(8),tb_segments)));
var ___$5 = cljs.core.println.call(null,(""+"[diag] stage3 trans-body first-ids="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(first_ids)+" preview='"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(org.kp.kpmc.parser.preview_text.call(null,text,(140)))+"'"));
var result = (cljs.core.truth_(ins_parser)?org.kp.kpmc.parser.parse_trans_body_by_subscriber.call(null,trans_body_parser,ins_parser,text,opts):(function (){var parsed = trans_body_parser.call(null,text,new cljs.core.Keyword(null,"optimize","optimize",-1912349448),new cljs.core.Keyword(null,"memory","memory",-1449401430));
if(instaparse.core.failure_QMARK_.call(null,parsed)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"success","success",1890645906),false,new cljs.core.Keyword(null,"failure","failure",720415879),parsed], null);
} else {
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"success","success",1890645906),true,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622),parsed], null);
}
})());
if(cljs.core.truth_(new cljs.core.Keyword(null,"success","success",1890645906).cljs$core$IFn$_invoke$arity$1(result))){
cljs.core.println.call(null,(""+"[diag] stage3 trans-body parse=ok subscribers="+cljs.core.str.cljs$core$IFn$_invoke$arity$1((function (){var or__5142__auto__ = new cljs.core.Keyword(null,"subscriber-count","subscriber-count",-1251628941).cljs$core$IFn$_invoke$arity$1(result);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "n/a";
}
})())));

return new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(result);
} else {
cljs.core.println.call(null,(""+"[diag] stage3 trans-body parse=failure error="+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"error","error",-978969032).cljs$core$IFn$_invoke$arity$1(result))));

return tb_node;
}
} else {
return tb_node;
}
});
var tree_after_stage2 = replace_node.call(null,new cljs.core.Keyword(null,"parse-tree","parse-tree",-942256622).cljs$core$IFn$_invoke$arity$1(envelope),new cljs.core.Keyword(null,"function_body","function_body",1179053955),expand_function_body);
var ___$5 = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-full:after-stage2",null);
var tree_after_stage3 = replace_node.call(null,tree_after_stage2,new cljs.core.Keyword(null,"trans_body","trans_body",-907422531),expand_trans_body);
var ___$6 = org.kp.kpmc.parser.log_memory_BANG_.call(null,log_memory_QMARK_,"parse-x12-full:after-stage3",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"isa-count","isa-count",-1910972782),cljs.core.count.call(null,org.kp.kpmc.parser.split_segments_by_isa.call(null,input_segments)),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.count.call(null,input_segments)], null));
return tree_after_stage3;
}));

(org.kp.kpmc.parser.parse_x12_full.cljs$lang$maxFixedArity = 2);

/**
 * Parse one complete ISA interchange supplied as text through all stages.
 */
org.kp.kpmc.parser.parse_x12_text = (function org$kp$kpmc$parser$parse_x12_text(var_args){
var G__2060 = arguments.length;
switch (G__2060) {
case 1:
return org.kp.kpmc.parser.parse_x12_text.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
case 2:
return org.kp.kpmc.parser.parse_x12_text.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.parser.parse_x12_text.cljs$core$IFn$_invoke$arity$1 = (function (input_text){
return org.kp.kpmc.parser.parse_x12_text.call(null,input_text,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.parser.parse_x12_text.cljs$core$IFn$_invoke$arity$2 = (function (input_text,opts){
if(clojure.string.blank_QMARK_.call(null,input_text)){
throw cljs.core.ex_info.call(null,"Cannot parse an empty ISA interchange",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"empty-isa","empty-isa",-92685674)], null));
} else {
}

return org.kp.kpmc.parser.parse_x12_full.call(null,"<streamed-isa>",cljs.core.assoc.call(null,opts,new cljs.core.Keyword(null,"input-text","input-text",-1336297114),input_text));
}));

(org.kp.kpmc.parser.parse_x12_text.cljs$lang$maxFixedArity = 2);

/**
 * Run full parse against test file and return unified parse tree.
 */
org.kp.kpmc.parser.test_full_parse = (function org$kp$kpmc$parser$test_full_parse(){
return org.kp.kpmc.parser.parse_x12_full.call(null,"src/main/resources/edisamples/test1.txt");
});

//# sourceMappingURL=parser.js.map
