// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.mapping_export');
goog.require('cljs.core');
goog.require('cljs.pprint');
goog.require('cljs.reader');
goog.require('clojure.string');
goog.require('org.kp.kpmc.io_node');
org.kp.kpmc.mapping_export.default_mapping_edn = "src/main/resources/companion-guide-db-mapping.edn";
org.kp.kpmc.mapping_export.default_output_csv = "target/companion-guide-db-mapping.csv";
org.kp.kpmc.mapping_export.default_lookup_spec_edn = "src/main/resources/companion-db-lookups.edn";
org.kp.kpmc.mapping_export.subscriber_lookup_tables = new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 15, ["TAP_PERSON_COVERAGE_RIDER",null,"TAP_PERSON_COVERAGE_AFFILIATION",null,"TAP_PERSON_COVERAGE",null,"TAP_PERSON",null,"TAP_PERSON_EMAIL",null,"TAP_PLAN_GROUP",null,"TAP_COVERAGE",null,"TAP_PERSON_COVERAGE_ATTRIBUTE",null,"TAP_PERSON_COVERAGE_PREMIUM_RATE",null,"TAP_PERSON_LANGUAGE",null,"TAP_PERSON_PHONE",null,"TAP_PERSON_COVERAGE_ADDRESS",null,"TAP_PERSON_EXTERNAL_IDENTIFIER",null,"TAP_PERSON_ADDRESS",null,"TAP_PERSON_COVERAGE_AFFILIATION_COMM",null], null), null);
org.kp.kpmc.mapping_export.qualifier_by_segment_description = new cljs.core.PersistentArrayMap(null, 5, ["Subscriber SSN","0F","Group Number / Purchaser ID","1L","Client Number","23","Subgroup Number","DX","Bill Group","ZZ"], null);
org.kp.kpmc.mapping_export.subscriber_ref_descriptions = cljs.core.set.call(null,cljs.core.keys.call(null,org.kp.kpmc.mapping_export.qualifier_by_segment_description));
org.kp.kpmc.mapping_export.csv_headers = new cljs.core.PersistentVector(null, 10, 5, cljs.core.PersistentVector.EMPTY_NODE, ["loop","segment_id","segment_description","table","business_object","segment_ref","column","data_type","context","notes"], null);
org.kp.kpmc.mapping_export.normalize = (function org$kp$kpmc$mapping_export$normalize(value){
if((value instanceof cljs.core.Keyword)){
return cljs.core.name.call(null,value);
} else {
if(typeof value === 'string'){
return value;
} else {
if((value == null)){
return "";
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(value));

}
}
}
});
org.kp.kpmc.mapping_export.element__GT_row = (function org$kp$kpmc$mapping_export$element__GT_row(loop_name,segment,target,element){
return new cljs.core.PersistentVector(null, 10, 5, cljs.core.PersistentVector.EMPTY_NODE, [org.kp.kpmc.mapping_export.normalize.call(null,loop_name),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(segment)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(segment)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(target)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"business-object","business-object",-1331950830).cljs$core$IFn$_invoke$arity$1(target)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(element)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"column","column",2078222095).cljs$core$IFn$_invoke$arity$1(element)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"data-type","data-type",-326421468).cljs$core$IFn$_invoke$arity$1(element)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"context","context",-830191113).cljs$core$IFn$_invoke$arity$1(element)),org.kp.kpmc.mapping_export.normalize.call(null,new cljs.core.Keyword(null,"notes","notes",-1039600523).cljs$core$IFn$_invoke$arity$1(element))], null);
});
org.kp.kpmc.mapping_export.mapping__GT_rows = (function org$kp$kpmc$mapping_export$mapping__GT_rows(mapping){
return cljs.core.vec.call(null,(function (){var iter__5628__auto__ = (function org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681(s__682){
return (new cljs.core.LazySeq(null,(function (){
var s__682__$1 = s__682;
while(true){
var temp__5825__auto__ = cljs.core.seq.call(null,s__682__$1);
if(temp__5825__auto__){
var xs__6385__auto__ = temp__5825__auto__;
var loop_entry = cljs.core.first.call(null,xs__6385__auto__);
var loop_name = new cljs.core.Keyword(null,"loop","loop",-395552849).cljs$core$IFn$_invoke$arity$1(loop_entry);
var iterys__5624__auto__ = ((function (s__682__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683(s__684){
return (new cljs.core.LazySeq(null,((function (s__682__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function (){
var s__684__$1 = s__684;
while(true){
var temp__5825__auto____$1 = cljs.core.seq.call(null,s__684__$1);
if(temp__5825__auto____$1){
var xs__6385__auto____$1 = temp__5825__auto____$1;
var segment = cljs.core.first.call(null,xs__6385__auto____$1);
var iterys__5624__auto__ = ((function (s__684__$1,s__682__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683_$_iter__685(s__686){
return (new cljs.core.LazySeq(null,((function (s__684__$1,s__682__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function (){
var s__686__$1 = s__686;
while(true){
var temp__5825__auto____$2 = cljs.core.seq.call(null,s__686__$1);
if(temp__5825__auto____$2){
var xs__6385__auto____$2 = temp__5825__auto____$2;
var target = cljs.core.first.call(null,xs__6385__auto____$2);
var iterys__5624__auto__ = ((function (s__686__$1,s__684__$1,s__682__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683_$_iter__685_$_iter__687(s__688){
return (new cljs.core.LazySeq(null,((function (s__686__$1,s__684__$1,s__682__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function (){
var s__688__$1 = s__688;
while(true){
var temp__5825__auto____$3 = cljs.core.seq.call(null,s__688__$1);
if(temp__5825__auto____$3){
var s__688__$2 = temp__5825__auto____$3;
if(cljs.core.chunked_seq_QMARK_.call(null,s__688__$2)){
var c__5626__auto__ = cljs.core.chunk_first.call(null,s__688__$2);
var size__5627__auto__ = cljs.core.count.call(null,c__5626__auto__);
var b__690 = cljs.core.chunk_buffer.call(null,size__5627__auto__);
if((function (){var i__689 = (0);
while(true){
if((i__689 < size__5627__auto__)){
var element = cljs.core._nth.call(null,c__5626__auto__,i__689);
cljs.core.chunk_append.call(null,b__690,org.kp.kpmc.mapping_export.element__GT_row.call(null,loop_name,segment,target,element));

var G__691 = (i__689 + (1));
i__689 = G__691;
continue;
} else {
return true;
}
break;
}
})()){
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__690),org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683_$_iter__685_$_iter__687.call(null,cljs.core.chunk_rest.call(null,s__688__$2)));
} else {
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__690),null);
}
} else {
var element = cljs.core.first.call(null,s__688__$2);
return cljs.core.cons.call(null,org.kp.kpmc.mapping_export.element__GT_row.call(null,loop_name,segment,target,element),org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683_$_iter__685_$_iter__687.call(null,cljs.core.rest.call(null,s__688__$2)));
}
} else {
return null;
}
break;
}
});})(s__686__$1,s__684__$1,s__682__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
,null,null));
});})(s__686__$1,s__684__$1,s__682__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
;
var fs__5625__auto__ = cljs.core.seq.call(null,iterys__5624__auto__.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(target)));
if(fs__5625__auto__){
return cljs.core.concat.call(null,fs__5625__auto__,org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683_$_iter__685.call(null,cljs.core.rest.call(null,s__686__$1)));
} else {
var G__692 = cljs.core.rest.call(null,s__686__$1);
s__686__$1 = G__692;
continue;
}
} else {
return null;
}
break;
}
});})(s__684__$1,s__682__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
,null,null));
});})(s__684__$1,s__682__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
;
var fs__5625__auto__ = cljs.core.seq.call(null,iterys__5624__auto__.call(null,new cljs.core.Keyword(null,"targets","targets",2014963406).cljs$core$IFn$_invoke$arity$1(segment)));
if(fs__5625__auto__){
return cljs.core.concat.call(null,fs__5625__auto__,org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681_$_iter__683.call(null,cljs.core.rest.call(null,s__684__$1)));
} else {
var G__693 = cljs.core.rest.call(null,s__684__$1);
s__684__$1 = G__693;
continue;
}
} else {
return null;
}
break;
}
});})(s__682__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
,null,null));
});})(s__682__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
;
var fs__5625__auto__ = cljs.core.seq.call(null,iterys__5624__auto__.call(null,new cljs.core.Keyword(null,"segments","segments",1937535949).cljs$core$IFn$_invoke$arity$1(loop_entry)));
if(fs__5625__auto__){
return cljs.core.concat.call(null,fs__5625__auto__,org$kp$kpmc$mapping_export$mapping__GT_rows_$_iter__681.call(null,cljs.core.rest.call(null,s__682__$1)));
} else {
var G__694 = cljs.core.rest.call(null,s__682__$1);
s__682__$1 = G__694;
continue;
}
} else {
return null;
}
break;
}
}),null,null));
});
return iter__5628__auto__.call(null,new cljs.core.Keyword(null,"mappings","mappings",254523771).cljs$core$IFn$_invoke$arity$1(mapping));
})());
});
org.kp.kpmc.mapping_export.mapping__GT_entries = (function org$kp$kpmc$mapping_export$mapping__GT_entries(mapping){
return cljs.core.vec.call(null,(function (){var iter__5628__auto__ = (function org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695(s__696){
return (new cljs.core.LazySeq(null,(function (){
var s__696__$1 = s__696;
while(true){
var temp__5825__auto__ = cljs.core.seq.call(null,s__696__$1);
if(temp__5825__auto__){
var xs__6385__auto__ = temp__5825__auto__;
var loop_entry = cljs.core.first.call(null,xs__6385__auto__);
var loop_name = new cljs.core.Keyword(null,"loop","loop",-395552849).cljs$core$IFn$_invoke$arity$1(loop_entry);
var iterys__5624__auto__ = ((function (s__696__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697(s__698){
return (new cljs.core.LazySeq(null,((function (s__696__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function (){
var s__698__$1 = s__698;
while(true){
var temp__5825__auto____$1 = cljs.core.seq.call(null,s__698__$1);
if(temp__5825__auto____$1){
var xs__6385__auto____$1 = temp__5825__auto____$1;
var segment = cljs.core.first.call(null,xs__6385__auto____$1);
var iterys__5624__auto__ = ((function (s__698__$1,s__696__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697_$_iter__699(s__700){
return (new cljs.core.LazySeq(null,((function (s__698__$1,s__696__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function (){
var s__700__$1 = s__700;
while(true){
var temp__5825__auto____$2 = cljs.core.seq.call(null,s__700__$1);
if(temp__5825__auto____$2){
var xs__6385__auto____$2 = temp__5825__auto____$2;
var target = cljs.core.first.call(null,xs__6385__auto____$2);
var iterys__5624__auto__ = ((function (s__700__$1,s__698__$1,s__696__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697_$_iter__699_$_iter__701(s__702){
return (new cljs.core.LazySeq(null,((function (s__700__$1,s__698__$1,s__696__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__){
return (function (){
var s__702__$1 = s__702;
while(true){
var temp__5825__auto____$3 = cljs.core.seq.call(null,s__702__$1);
if(temp__5825__auto____$3){
var s__702__$2 = temp__5825__auto____$3;
if(cljs.core.chunked_seq_QMARK_.call(null,s__702__$2)){
var c__5626__auto__ = cljs.core.chunk_first.call(null,s__702__$2);
var size__5627__auto__ = cljs.core.count.call(null,c__5626__auto__);
var b__704 = cljs.core.chunk_buffer.call(null,size__5627__auto__);
if((function (){var i__703 = (0);
while(true){
if((i__703 < size__5627__auto__)){
var element = cljs.core._nth.call(null,c__5626__auto__,i__703);
cljs.core.chunk_append.call(null,b__704,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"loop","loop",-395552849),loop_name,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(segment),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(segment),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"table","table",-564943036),new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(target),new cljs.core.Keyword(null,"column","column",2078222095),new cljs.core.Keyword(null,"column","column",2078222095).cljs$core$IFn$_invoke$arity$1(element)], null));

var G__705 = (i__703 + (1));
i__703 = G__705;
continue;
} else {
return true;
}
break;
}
})()){
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__704),org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697_$_iter__699_$_iter__701.call(null,cljs.core.chunk_rest.call(null,s__702__$2)));
} else {
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__704),null);
}
} else {
var element = cljs.core.first.call(null,s__702__$2);
return cljs.core.cons.call(null,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"loop","loop",-395552849),loop_name,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590).cljs$core$IFn$_invoke$arity$1(segment),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987),new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(segment),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(element),new cljs.core.Keyword(null,"table","table",-564943036),new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(target),new cljs.core.Keyword(null,"column","column",2078222095),new cljs.core.Keyword(null,"column","column",2078222095).cljs$core$IFn$_invoke$arity$1(element)], null),org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697_$_iter__699_$_iter__701.call(null,cljs.core.rest.call(null,s__702__$2)));
}
} else {
return null;
}
break;
}
});})(s__700__$1,s__698__$1,s__696__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
,null,null));
});})(s__700__$1,s__698__$1,s__696__$1,target,xs__6385__auto____$2,temp__5825__auto____$2,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
;
var fs__5625__auto__ = cljs.core.seq.call(null,iterys__5624__auto__.call(null,new cljs.core.Keyword(null,"elements","elements",657646735).cljs$core$IFn$_invoke$arity$1(target)));
if(fs__5625__auto__){
return cljs.core.concat.call(null,fs__5625__auto__,org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697_$_iter__699.call(null,cljs.core.rest.call(null,s__700__$1)));
} else {
var G__706 = cljs.core.rest.call(null,s__700__$1);
s__700__$1 = G__706;
continue;
}
} else {
return null;
}
break;
}
});})(s__698__$1,s__696__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
,null,null));
});})(s__698__$1,s__696__$1,segment,xs__6385__auto____$1,temp__5825__auto____$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
;
var fs__5625__auto__ = cljs.core.seq.call(null,iterys__5624__auto__.call(null,new cljs.core.Keyword(null,"targets","targets",2014963406).cljs$core$IFn$_invoke$arity$1(segment)));
if(fs__5625__auto__){
return cljs.core.concat.call(null,fs__5625__auto__,org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695_$_iter__697.call(null,cljs.core.rest.call(null,s__698__$1)));
} else {
var G__707 = cljs.core.rest.call(null,s__698__$1);
s__698__$1 = G__707;
continue;
}
} else {
return null;
}
break;
}
});})(s__696__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
,null,null));
});})(s__696__$1,loop_name,loop_entry,xs__6385__auto__,temp__5825__auto__))
;
var fs__5625__auto__ = cljs.core.seq.call(null,iterys__5624__auto__.call(null,new cljs.core.Keyword(null,"segments","segments",1937535949).cljs$core$IFn$_invoke$arity$1(loop_entry)));
if(fs__5625__auto__){
return cljs.core.concat.call(null,fs__5625__auto__,org$kp$kpmc$mapping_export$mapping__GT_entries_$_iter__695.call(null,cljs.core.rest.call(null,s__696__$1)));
} else {
var G__708 = cljs.core.rest.call(null,s__696__$1);
s__696__$1 = G__708;
continue;
}
} else {
return null;
}
break;
}
}),null,null));
});
return iter__5628__auto__.call(null,new cljs.core.Keyword(null,"mappings","mappings",254523771).cljs$core$IFn$_invoke$arity$1(mapping));
})());
});
org.kp.kpmc.mapping_export.subscriber_loop_QMARK_ = (function org$kp$kpmc$mapping_export$subscriber_loop_QMARK_(loop_name){
return cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/^[2-9].*/,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(loop_name))));
});
org.kp.kpmc.mapping_export.lookup_id = (function org$kp$kpmc$mapping_export$lookup_id(var_args){
var args__5882__auto__ = [];
var len__5876__auto___712 = arguments.length;
var i__5877__auto___713 = (0);
while(true){
if((i__5877__auto___713 < len__5876__auto___712)){
args__5882__auto__.push((arguments[i__5877__auto___713]));

var G__714 = (i__5877__auto___713 + (1));
i__5877__auto___713 = G__714;
continue;
} else {
}
break;
}

var argseq__5883__auto__ = ((((0) < args__5882__auto__.length))?(new cljs.core.IndexedSeq(args__5882__auto__.slice((0)),(0),null)):null);
return org.kp.kpmc.mapping_export.lookup_id.cljs$core$IFn$_invoke$arity$variadic(argseq__5883__auto__);
});

(org.kp.kpmc.mapping_export.lookup_id.cljs$core$IFn$_invoke$arity$variadic = (function (parts){
return clojure.string.join.call(null,"-",cljs.core.remove.call(null,cljs.core.empty_QMARK_,cljs.core.map.call(null,(function (p1__710_SHARP_){
return clojure.string.replace.call(null,p1__710_SHARP_,/(^-|-$)/,"");
}),cljs.core.map.call(null,(function (p1__709_SHARP_){
return clojure.string.replace.call(null,p1__709_SHARP_,/[^a-z0-9]+/,"-");
}),cljs.core.map.call(null,clojure.string.lower_case,cljs.core.map.call(null,cljs.core.str,parts))))));
}));

(org.kp.kpmc.mapping_export.lookup_id.cljs$lang$maxFixedArity = (0));

/** @this {Function} */
(org.kp.kpmc.mapping_export.lookup_id.cljs$lang$applyTo = (function (seq711){
var self__5862__auto__ = this;
return self__5862__auto__.cljs$core$IFn$_invoke$arity$variadic(cljs.core.seq.call(null,seq711));
}));

org.kp.kpmc.mapping_export.table_column_spec = (function org$kp$kpmc$mapping_export$table_column_spec(p__715){
var map__716 = p__715;
var map__716__$1 = cljs.core.__destructure_map.call(null,map__716);
var loop = cljs.core.get.call(null,map__716__$1,new cljs.core.Keyword(null,"loop","loop",-395552849));
var segment_id = cljs.core.get.call(null,map__716__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var segment_ref = cljs.core.get.call(null,map__716__$1,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482));
var table = cljs.core.get.call(null,map__716__$1,new cljs.core.Keyword(null,"table","table",-564943036));
var column = cljs.core.get.call(null,map__716__$1,new cljs.core.Keyword(null,"column","column",2078222095));
return new cljs.core.PersistentArrayMap(null, 8, [new cljs.core.Keyword(null,"id","id",-1388402092),org.kp.kpmc.mapping_export.lookup_id.call(null,loop,segment_id,segment_ref),new cljs.core.Keyword(null,"loop","loop",-395552849),loop,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),segment_id,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),segment_ref,new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),true,new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838),new cljs.core.Keyword(null,"table-column","table-column",1855885298),new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"column","column",2078222095),column], null);
});
org.kp.kpmc.mapping_export.conditional_ref02_spec = (function org$kp$kpmc$mapping_export$conditional_ref02_spec(entries){
var map__717 = cljs.core.first.call(null,entries);
var map__717__$1 = cljs.core.__destructure_map.call(null,map__717);
var loop = cljs.core.get.call(null,map__717__$1,new cljs.core.Keyword(null,"loop","loop",-395552849));
var segment_id = cljs.core.get.call(null,map__717__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var segment_ref = cljs.core.get.call(null,map__717__$1,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482));
return new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"id","id",-1388402092),org.kp.kpmc.mapping_export.lookup_id.call(null,loop,segment_id,segment_ref),new cljs.core.Keyword(null,"loop","loop",-395552849),loop,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),segment_id,new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),segment_ref,new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),true,new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838),new cljs.core.Keyword(null,"conditional-table-column","conditional-table-column",1803747140),new cljs.core.Keyword(null,"cases","cases",253862775),cljs.core.mapv.call(null,(function (p__718){
var map__719 = p__718;
var map__719__$1 = cljs.core.__destructure_map.call(null,map__719);
var segment_description = cljs.core.get.call(null,map__719__$1,new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987));
var table = cljs.core.get.call(null,map__719__$1,new cljs.core.Keyword(null,"table","table",-564943036));
var column = cljs.core.get.call(null,map__719__$1,new cljs.core.Keyword(null,"column","column",2078222095));
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"when","when",-576417306),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"ref","ref",1289896967),"REF01",new cljs.core.Keyword(null,"equals","equals",-463033970),cljs.core.get.call(null,org.kp.kpmc.mapping_export.qualifier_by_segment_description,segment_description)], null),new cljs.core.Keyword(null,"table","table",-564943036),table,new cljs.core.Keyword(null,"column","column",2078222095),column], null);
}),entries)], null);
});
org.kp.kpmc.mapping_export.coverage_date_spec = (function org$kp$kpmc$mapping_export$coverage_date_spec(){
return new cljs.core.PersistentArrayMap(null, 7, [new cljs.core.Keyword(null,"id","id",-1388402092),"2300-dtp-dtp03",new cljs.core.Keyword(null,"loop","loop",-395552849),"2300",new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),"DTP",new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482),"DTP03",new cljs.core.Keyword(null,"enabled?","enabled?",-1376075057),true,new cljs.core.Keyword(null,"lookup-kind","lookup-kind",-805434838),new cljs.core.Keyword(null,"conditional-table-column","conditional-table-column",1803747140),new cljs.core.Keyword(null,"cases","cases",253862775),new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"when","when",-576417306),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"ref","ref",1289896967),"DTP01",new cljs.core.Keyword(null,"equals","equals",-463033970),"348"], null),new cljs.core.Keyword(null,"table","table",-564943036),"TAP_COVERAGE",new cljs.core.Keyword(null,"column","column",2078222095),"COVERAGE_START_DATE"], null),new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"when","when",-576417306),new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"ref","ref",1289896967),"DTP01",new cljs.core.Keyword(null,"equals","equals",-463033970),"349"], null),new cljs.core.Keyword(null,"table","table",-564943036),"TAP_COVERAGE",new cljs.core.Keyword(null,"column","column",2078222095),"COVERAGE_END_DATE"], null)], null)], null);
});
org.kp.kpmc.mapping_export.mapping__GT_lookup_specs = (function org$kp$kpmc$mapping_export$mapping__GT_lookup_specs(mapping){
var entries = cljs.core.vec.call(null,cljs.core.remove.call(null,(function (p1__724_SHARP_){
return ((cljs.core._EQ_.call(null,"2300",new cljs.core.Keyword(null,"loop","loop",-395552849).cljs$core$IFn$_invoke$arity$1(p1__724_SHARP_))) && (cljs.core._EQ_.call(null,"DTP03",new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(p1__724_SHARP_))));
}),cljs.core.remove.call(null,(function (p1__723_SHARP_){
return cljs.core._EQ_.call(null,"DTP01",new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(p1__723_SHARP_));
}),cljs.core.filter.call(null,(function (p1__722_SHARP_){
return ((cljs.core.not_EQ_.call(null,"REF02",new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482).cljs$core$IFn$_invoke$arity$1(p1__722_SHARP_))) || (cljs.core.contains_QMARK_.call(null,org.kp.kpmc.mapping_export.subscriber_ref_descriptions,new cljs.core.Keyword(null,"segment-description","segment-description",-1183758987).cljs$core$IFn$_invoke$arity$1(p1__722_SHARP_))));
}),cljs.core.filter.call(null,(function (p1__721_SHARP_){
return cljs.core.contains_QMARK_.call(null,org.kp.kpmc.mapping_export.subscriber_lookup_tables,new cljs.core.Keyword(null,"table","table",-564943036).cljs$core$IFn$_invoke$arity$1(p1__721_SHARP_));
}),cljs.core.filter.call(null,(function (p1__720_SHARP_){
return org.kp.kpmc.mapping_export.subscriber_loop_QMARK_.call(null,new cljs.core.Keyword(null,"loop","loop",-395552849).cljs$core$IFn$_invoke$arity$1(p1__720_SHARP_));
}),org.kp.kpmc.mapping_export.mapping__GT_entries.call(null,mapping)))))));
var grouped = cljs.core.group_by.call(null,cljs.core.juxt.call(null,new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482)),entries);
var specs = cljs.core.mapv.call(null,(function (p__725){
var vec__726 = p__725;
var key = cljs.core.nth.call(null,vec__726,(0),null);
var matching_entries = cljs.core.nth.call(null,vec__726,(1),null);
if(cljs.core._EQ_.call(null,key,new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","REF","REF02"], null))){
return org.kp.kpmc.mapping_export.conditional_ref02_spec.call(null,matching_entries);
} else {
return org.kp.kpmc.mapping_export.table_column_spec.call(null,cljs.core.first.call(null,matching_entries));
}
}),cljs.core.sort_by.call(null,cljs.core.key,grouped));
return cljs.core.vec.call(null,cljs.core.sort_by.call(null,cljs.core.juxt.call(null,new cljs.core.Keyword(null,"loop","loop",-395552849),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),new cljs.core.Keyword(null,"segment-ref","segment-ref",1989737482)),cljs.core.conj.call(null,specs,org.kp.kpmc.mapping_export.coverage_date_spec.call(null))));
});
org.kp.kpmc.mapping_export.read_mapping_edn = (function org$kp$kpmc$mapping_export$read_mapping_edn(path){
return cljs.reader.read_string.call(null,org.kp.kpmc.io_node.read_text.call(null,path));
});
org.kp.kpmc.mapping_export.write_text_with_parents_BANG_ = (function org$kp$kpmc$mapping_export$write_text_with_parents_BANG_(output_path,text){
var fs = require("fs");
var path = require("path");
var parent = path.dirname(output_path);
fs.mkdirSync(parent,({"recursive": true}));

return org.kp.kpmc.io_node.write_text.call(null,output_path,text);
});
org.kp.kpmc.mapping_export.write_lookup_specs_BANG_ = (function org$kp$kpmc$mapping_export$write_lookup_specs_BANG_(var_args){
var G__730 = arguments.length;
switch (G__730) {
case 2:
return org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 0:
return org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.cljs$core$IFn$_invoke$arity$0();

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.cljs$core$IFn$_invoke$arity$2 = (function (mapping_path,output_path){
var mapping = org.kp.kpmc.mapping_export.read_mapping_edn.call(null,mapping_path);
var specs = org.kp.kpmc.mapping_export.mapping__GT_lookup_specs.call(null,mapping);
var document__$1 = new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"source-mapping","source-mapping",1088103442),mapping_path,new cljs.core.Keyword(null,"specs","specs",1426570741),specs], null);
if(cljs.core.empty_QMARK_.call(null,specs)){
throw cljs.core.ex_info.call(null,"No subscriber lookup specs generated",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"mapping-path","mapping-path",1018127234),mapping_path], null));
} else {
}

org.kp.kpmc.mapping_export.write_text_with_parents_BANG_.call(null,output_path,(function (){var sb__5795__auto__ = (new goog.string.StringBuffer());
var _STAR_print_newline_STAR__orig_val__731_736 = cljs.core._STAR_print_newline_STAR_;
var _STAR_print_fn_STAR__orig_val__732_737 = cljs.core._STAR_print_fn_STAR_;
var _STAR_print_newline_STAR__temp_val__733_738 = true;
var _STAR_print_fn_STAR__temp_val__734_739 = (function (x__5796__auto__){
return sb__5795__auto__.append(x__5796__auto__);
});
(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__temp_val__733_738);

(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__temp_val__734_739);

try{cljs.pprint.pprint.call(null,document__$1);
}finally {(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__orig_val__732_737);

(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__orig_val__731_736);
}
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(sb__5795__auto__));
})());

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"specs","specs",1426570741),cljs.core.count.call(null,specs),new cljs.core.Keyword(null,"output","output",-1105869043),output_path], null);
}));

(org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.cljs$core$IFn$_invoke$arity$0 = (function (){
return org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.call(null,org.kp.kpmc.mapping_export.default_mapping_edn,org.kp.kpmc.mapping_export.default_lookup_spec_edn);
}));

(org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.cljs$lang$maxFixedArity = 2);

org.kp.kpmc.mapping_export.csv_cell = (function org$kp$kpmc$mapping_export$csv_cell(value){
var text = org.kp.kpmc.mapping_export.normalize.call(null,value);
if(cljs.core.truth_(cljs.core.re_find.call(null,/[\",\r\n]/,text))){
return (""+"\""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.replace.call(null,text,"\"","\"\""))+"\"");
} else {
return text;
}
});
org.kp.kpmc.mapping_export.write_csv_BANG_ = (function org$kp$kpmc$mapping_export$write_csv_BANG_(rows,output_path){
var lines = cljs.core.map.call(null,(function (p1__740_SHARP_){
return clojure.string.join.call(null,",",cljs.core.map.call(null,org.kp.kpmc.mapping_export.csv_cell,p1__740_SHARP_));
}),cljs.core.cons.call(null,org.kp.kpmc.mapping_export.csv_headers,rows));
return org.kp.kpmc.mapping_export.write_text_with_parents_BANG_.call(null,output_path,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(clojure.string.join.call(null,"\n",lines))+"\n"));
});
org.kp.kpmc.mapping_export.export_mapping_BANG_ = (function org$kp$kpmc$mapping_export$export_mapping_BANG_(var_args){
var G__742 = arguments.length;
switch (G__742) {
case 2:
return org.kp.kpmc.mapping_export.export_mapping_BANG_.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 0:
return org.kp.kpmc.mapping_export.export_mapping_BANG_.cljs$core$IFn$_invoke$arity$0();

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.mapping_export.export_mapping_BANG_.cljs$core$IFn$_invoke$arity$2 = (function (edn_path,csv_path){
var mapping = org.kp.kpmc.mapping_export.read_mapping_edn.call(null,edn_path);
var rows = org.kp.kpmc.mapping_export.mapping__GT_rows.call(null,mapping);
if(cljs.core.empty_QMARK_.call(null,rows)){
throw cljs.core.ex_info.call(null,"No mapping rows found",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"edn-path","edn-path",-1282501380),edn_path], null));
} else {
}

org.kp.kpmc.mapping_export.write_csv_BANG_.call(null,rows,csv_path);

return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"rows","rows",850049680),cljs.core.count.call(null,rows),new cljs.core.Keyword(null,"output","output",-1105869043),csv_path], null);
}));

(org.kp.kpmc.mapping_export.export_mapping_BANG_.cljs$core$IFn$_invoke$arity$0 = (function (){
return org.kp.kpmc.mapping_export.export_mapping_BANG_.call(null,org.kp.kpmc.mapping_export.default_mapping_edn,org.kp.kpmc.mapping_export.default_output_csv);
}));

(org.kp.kpmc.mapping_export.export_mapping_BANG_.cljs$lang$maxFixedArity = 2);


//# sourceMappingURL=mapping_export.js.map
