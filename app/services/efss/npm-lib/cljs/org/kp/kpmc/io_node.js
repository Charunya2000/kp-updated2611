// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.io_node');
goog.require('cljs.core');
goog.require('cljs.pprint');
/**
 * Read UTF-8 text from disk via Node.js fs.
 */
org.kp.kpmc.io_node.read_text = (function org$kp$kpmc$io_node$read_text(path){
return require("fs").readFileSync(path,"utf8");
});
/**
 * Reduce complete ISA/IEA interchanges from a file without retaining prior ISAs.
 */
org.kp.kpmc.io_node.reduce_isa_file = (function org$kp$kpmc$io_node$reduce_isa_file(var_args){
var G__625 = arguments.length;
switch (G__625) {
case 3:
return org.kp.kpmc.io_node.reduce_isa_file.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
case 4:
return org.kp.kpmc.io_node.reduce_isa_file.cljs$core$IFn$_invoke$arity$4((arguments[(0)]),(arguments[(1)]),(arguments[(2)]),(arguments[(3)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.io_node.reduce_isa_file.cljs$core$IFn$_invoke$arity$3 = (function (path,rf,init){
return org.kp.kpmc.io_node.reduce_isa_file.call(null,path,cljs.core.PersistentArrayMap.EMPTY,rf,init);
}));

(org.kp.kpmc.io_node.reduce_isa_file.cljs$core$IFn$_invoke$arity$4 = (function (path,opts,rf,init){
var fs = require("fs");
var StringDecoder = require("string_decoder").StringDecoder;
var decoder = (new StringDecoder("utf8"));
var chunk_size = cljs.core.max.call(null,(1024),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"read-buffer-size","read-buffer-size",-876215313).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (65536);
}
})());
var buffer = Buffer.alloc(chunk_size);
var fd = fs.openSync(path,"r");
var pending_STAR_ = cljs.core.atom.call(null,"");
var terminator_STAR_ = cljs.core.atom.call(null,null);
var isa_segments_STAR_ = cljs.core.atom.call(null,null);
var isa_index_STAR_ = cljs.core.atom.call(null,(0));
var acc_STAR_ = cljs.core.atom.call(null,init);
var process_segment_BANG_ = (function (raw_segment){
var segment = raw_segment.trim();
var segment_id = cljs.core.first.call(null,segment.split("*"));
if(cljs.core.seq.call(null,segment)){
if(cljs.core._EQ_.call(null,segment_id,"ISA")){
if(cljs.core.truth_(cljs.core.deref.call(null,isa_segments_STAR_))){
throw cljs.core.ex_info.call(null,"Nested ISA encountered before IEA",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"nested-isa","nested-isa",-1188588520),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),(cljs.core.deref.call(null,isa_index_STAR_) + (1))], null));
} else {
return cljs.core.reset_BANG_.call(null,isa_segments_STAR_,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [segment], null));
}
} else {
if((cljs.core.deref.call(null,isa_segments_STAR_) == null)){
throw cljs.core.ex_info.call(null,"Content before the first ISA is not supported",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"content-before-isa","content-before-isa",-1278592798),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),segment_id], null));
} else {
cljs.core.swap_BANG_.call(null,isa_segments_STAR_,cljs.core.conj,segment);

if(cljs.core._EQ_.call(null,segment_id,"IEA")){
var segments = cljs.core.deref.call(null,isa_segments_STAR_);
var isa_index = cljs.core.swap_BANG_.call(null,isa_index_STAR_,cljs.core.inc);
if((cljs.core.count.call(null,segments) <= (2))){
throw cljs.core.ex_info.call(null,"ISA interchange contains no functional-group content",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"empty-isa","empty-isa",-92685674),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index], null));
} else {
}

cljs.core.reset_BANG_.call(null,acc_STAR_,rf.call(null,cljs.core.deref.call(null,acc_STAR_),new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),isa_index,new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.count.call(null,segments),new cljs.core.Keyword(null,"text","text",-1790561697),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.clj__GT_js.call(null,segments).join(cljs.core.deref.call(null,terminator_STAR_)))+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,terminator_STAR_)))], null)));

return cljs.core.reset_BANG_.call(null,isa_segments_STAR_,null);
} else {
return null;
}

}
}
} else {
return null;
}
});
var consume_complete_segments_BANG_ = (function (){
while(true){
var temp__5825__auto__ = cljs.core.deref.call(null,terminator_STAR_);
if(cljs.core.truth_(temp__5825__auto__)){
var terminator = temp__5825__auto__;
var pending = cljs.core.deref.call(null,pending_STAR_);
var idx = pending.indexOf(terminator);
if(cljs.core.not_EQ_.call(null,(-1),idx)){
process_segment_BANG_.call(null,pending.slice((0),idx));

cljs.core.reset_BANG_.call(null,pending_STAR_,pending.slice((idx + (1))));

continue;
} else {
return null;
}
} else {
return null;
}
break;
}
});
try{var position = (0);
while(true){
var bytes_read = fs.readSync(fd,buffer,(0),chunk_size,position);
if((bytes_read === (0))){
cljs.core.swap_BANG_.call(null,pending_STAR_,cljs.core.str,decoder.end());

if((((cljs.core.deref.call(null,terminator_STAR_) == null)) && (cljs.core.seq.call(null,cljs.core.deref.call(null,pending_STAR_).trim())))){
throw cljs.core.ex_info.call(null,"Unable to detect the ISA segment terminator",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-segment-terminator","invalid-segment-terminator",1262584038)], null));
} else {
}

consume_complete_segments_BANG_.call(null);

if(cljs.core.seq.call(null,cljs.core.deref.call(null,pending_STAR_).trim())){
throw cljs.core.ex_info.call(null,"Input ends with an unterminated segment",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-segment-terminator","invalid-segment-terminator",1262584038)], null));
} else {
}

if(cljs.core.truth_(cljs.core.deref.call(null,isa_segments_STAR_))){
throw cljs.core.ex_info.call(null,"ISA interchange is missing its IEA trailer",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-iea","missing-iea",1860407259),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),(cljs.core.deref.call(null,isa_index_STAR_) + (1))], null));
} else {
}

if((cljs.core.deref.call(null,isa_index_STAR_) === (0))){
throw cljs.core.ex_info.call(null,"EDI file contains no ISA interchange",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"empty-edi-file","empty-edi-file",958558062)], null));
} else {
}

return cljs.core.deref.call(null,acc_STAR_);
} else {
cljs.core.swap_BANG_.call(null,pending_STAR_,cljs.core.str,decoder.write(buffer.subarray((0),bytes_read)));

if((((cljs.core.deref.call(null,terminator_STAR_) == null)) && ((cljs.core.count.call(null,cljs.core.deref.call(null,pending_STAR_)) >= (106))))){
if(cljs.core._EQ_.call(null,"ISA",cljs.core.deref.call(null,pending_STAR_).slice((0),(3)))){
} else {
throw cljs.core.ex_info.call(null,"EDI input must begin with ISA",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"content-before-isa","content-before-isa",-1278592798)], null));
}

var terminator_627 = cljs.core.deref.call(null,pending_STAR_).charAt((105));
if(((cljs.core._EQ_.call(null,terminator_627,"")) || (cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/[A-Za-z0-9*\x00-\x20\x7F-\xFF]/,terminator_627))))){
throw cljs.core.ex_info.call(null,"Invalid ISA segment terminator",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-segment-terminator","invalid-segment-terminator",1262584038)], null));
} else {
}

cljs.core.reset_BANG_.call(null,terminator_STAR_,terminator_627);
} else {
}

consume_complete_segments_BANG_.call(null);

var G__628 = (position + bytes_read);
position = G__628;
continue;
}
break;
}
}finally {fs.closeSync(fd);
}}));

(org.kp.kpmc.io_node.reduce_isa_file.cljs$lang$maxFixedArity = 4);

/**
 * Reduce an EDI file as ordered context segments and INS-started subscriber blocks.
 *   Only the current subscriber block is retained.
 */
org.kp.kpmc.io_node.reduce_ins_file = (function org$kp$kpmc$io_node$reduce_ins_file(var_args){
var G__630 = arguments.length;
switch (G__630) {
case 3:
return org.kp.kpmc.io_node.reduce_ins_file.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
case 4:
return org.kp.kpmc.io_node.reduce_ins_file.cljs$core$IFn$_invoke$arity$4((arguments[(0)]),(arguments[(1)]),(arguments[(2)]),(arguments[(3)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.io_node.reduce_ins_file.cljs$core$IFn$_invoke$arity$3 = (function (path,rf,init){
return org.kp.kpmc.io_node.reduce_ins_file.call(null,path,cljs.core.PersistentArrayMap.EMPTY,rf,init);
}));

(org.kp.kpmc.io_node.reduce_ins_file.cljs$core$IFn$_invoke$arity$4 = (function (path,opts,rf,init){
var fs = require("fs");
var StringDecoder = require("string_decoder").StringDecoder;
var decoder = (new StringDecoder("utf8"));
var chunk_size = cljs.core.max.call(null,(1024),(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"read-buffer-size","read-buffer-size",-876215313).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return (65536);
}
})());
var buffer = Buffer.alloc(chunk_size);
var fd = fs.openSync(path,"r");
var pending_STAR_ = cljs.core.atom.call(null,"");
var terminator_STAR_ = cljs.core.atom.call(null,null);
var isa_index_STAR_ = cljs.core.atom.call(null,(0));
var transaction_index_STAR_ = cljs.core.atom.call(null,(0));
var subscriber_index_STAR_ = cljs.core.atom.call(null,(0));
var isa_segment_count_STAR_ = cljs.core.atom.call(null,(0));
var in_isa_QMARK__STAR_ = cljs.core.atom.call(null,false);
var in_group_QMARK__STAR_ = cljs.core.atom.call(null,false);
var in_transaction_QMARK__STAR_ = cljs.core.atom.call(null,false);
var subscriber_segments_STAR_ = cljs.core.atom.call(null,null);
var acc_STAR_ = cljs.core.atom.call(null,init);
var emit_BANG_ = (function (unit){
return cljs.core.reset_BANG_.call(null,acc_STAR_,rf.call(null,cljs.core.deref.call(null,acc_STAR_),unit));
});
var flush_subscriber_BANG_ = (function (){
var temp__5825__auto__ = cljs.core.deref.call(null,subscriber_segments_STAR_);
if(cljs.core.truth_(temp__5825__auto__)){
var segments = temp__5825__auto__;
emit_BANG_.call(null,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"subscriber","subscriber",-2064338413),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),cljs.core.deref.call(null,transaction_index_STAR_),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),cljs.core.deref.call(null,subscriber_index_STAR_),new cljs.core.Keyword(null,"segment-count","segment-count",681013183),cljs.core.count.call(null,segments),new cljs.core.Keyword(null,"text","text",-1790561697),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.clj__GT_js.call(null,segments).join(cljs.core.deref.call(null,terminator_STAR_)))+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,terminator_STAR_)))], null));

return cljs.core.reset_BANG_.call(null,subscriber_segments_STAR_,null);
} else {
return null;
}
});
var emit_context_BANG_ = (function (segment,segment_id){
return emit_BANG_.call(null,new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"context","context",-830191113),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))?cljs.core.deref.call(null,transaction_index_STAR_):null),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),segment_id,new cljs.core.Keyword(null,"segment","segment",-964921196),segment,new cljs.core.Keyword(null,"text","text",-1790561697),(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(segment)+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.deref.call(null,terminator_STAR_)))], null));
});
var process_segment_BANG_ = (function (raw_segment){
var segment = raw_segment.trim();
var segment_id = cljs.core.first.call(null,segment.split("*"));
if(cljs.core.seq.call(null,segment)){
if(cljs.core._EQ_.call(null,segment_id,"ISA")){
if(cljs.core.truth_(cljs.core.deref.call(null,in_isa_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"Nested ISA encountered before IEA",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"nested-isa","nested-isa",-1188588520),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),(cljs.core.deref.call(null,isa_index_STAR_) + (1))], null));
} else {
cljs.core.swap_BANG_.call(null,isa_index_STAR_,cljs.core.inc);

cljs.core.reset_BANG_.call(null,transaction_index_STAR_,(0));

cljs.core.reset_BANG_.call(null,isa_segment_count_STAR_,(1));

cljs.core.reset_BANG_.call(null,in_isa_QMARK__STAR_,true);

cljs.core.reset_BANG_.call(null,in_group_QMARK__STAR_,false);

return emit_context_BANG_.call(null,segment,segment_id);
}
} else {
if(cljs.core.not.call(null,cljs.core.deref.call(null,in_isa_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"Content before the first ISA is not supported",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"content-before-isa","content-before-isa",-1278592798),new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),segment_id], null));
} else {
cljs.core.swap_BANG_.call(null,isa_segment_count_STAR_,cljs.core.inc);

if(cljs.core._EQ_.call(null,segment_id,"GS")){
if(cljs.core.truth_((function (){var or__5142__auto__ = cljs.core.deref.call(null,in_group_QMARK__STAR_);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.deref.call(null,in_transaction_QMARK__STAR_);
}
})())){
throw cljs.core.ex_info.call(null,"Nested GS encountered before GE",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"nested-functional-group","nested-functional-group",1230570174),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
} else {
}

cljs.core.reset_BANG_.call(null,in_group_QMARK__STAR_,true);

return emit_context_BANG_.call(null,segment,segment_id);
} else {
if(cljs.core._EQ_.call(null,segment_id,"ST")){
if(cljs.core.truth_(cljs.core.deref.call(null,in_group_QMARK__STAR_))){
} else {
throw cljs.core.ex_info.call(null,"ST encountered outside a GS/GE group",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"st-outside-functional-group","st-outside-functional-group",13882622),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
}

if(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"Nested ST encountered before SE",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"nested-transaction","nested-transaction",-1379666176),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),cljs.core.deref.call(null,transaction_index_STAR_)], null));
} else {
}

cljs.core.swap_BANG_.call(null,transaction_index_STAR_,cljs.core.inc);

cljs.core.reset_BANG_.call(null,in_transaction_QMARK__STAR_,true);

return emit_context_BANG_.call(null,segment,segment_id);
} else {
if(cljs.core._EQ_.call(null,segment_id,"INS")){
if(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))){
} else {
throw cljs.core.ex_info.call(null,"INS encountered outside an ST/SE transaction",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"ins-outside-transaction","ins-outside-transaction",-1824232041),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
}

flush_subscriber_BANG_.call(null);

cljs.core.swap_BANG_.call(null,subscriber_index_STAR_,cljs.core.inc);

return cljs.core.reset_BANG_.call(null,subscriber_segments_STAR_,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [segment], null));
} else {
if(cljs.core._EQ_.call(null,segment_id,"SE")){
if(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))){
} else {
throw cljs.core.ex_info.call(null,"SE encountered without ST",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"se-without-st","se-without-st",1364826568),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
}

flush_subscriber_BANG_.call(null);

emit_context_BANG_.call(null,segment,segment_id);

return cljs.core.reset_BANG_.call(null,in_transaction_QMARK__STAR_,false);
} else {
if(cljs.core._EQ_.call(null,segment_id,"GE")){
if(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"Functional group ended before SE",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-se","missing-se",1394106028),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),cljs.core.deref.call(null,transaction_index_STAR_)], null));
} else {
}

if(cljs.core.truth_(cljs.core.deref.call(null,in_group_QMARK__STAR_))){
} else {
throw cljs.core.ex_info.call(null,"GE encountered without GS",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"ge-without-gs","ge-without-gs",1163564025),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
}

emit_context_BANG_.call(null,segment,segment_id);

return cljs.core.reset_BANG_.call(null,in_group_QMARK__STAR_,false);
} else {
if(cljs.core._EQ_.call(null,segment_id,"IEA")){
if(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"ISA interchange ended before SE",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-se","missing-se",1394106028),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),cljs.core.deref.call(null,transaction_index_STAR_)], null));
} else {
}

if(cljs.core.truth_(cljs.core.deref.call(null,in_group_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"ISA interchange ended before GE",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-ge","missing-ge",-445925504),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
} else {
}

if((cljs.core.deref.call(null,isa_segment_count_STAR_) <= (2))){
throw cljs.core.ex_info.call(null,"ISA interchange contains no functional-group content",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"empty-isa","empty-isa",-92685674),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
} else {
}

emit_context_BANG_.call(null,segment,segment_id);

return cljs.core.reset_BANG_.call(null,in_isa_QMARK__STAR_,false);
} else {
if(cljs.core.truth_(cljs.core.deref.call(null,subscriber_segments_STAR_))){
return cljs.core.swap_BANG_.call(null,subscriber_segments_STAR_,cljs.core.conj,segment);
} else {
return emit_context_BANG_.call(null,segment,segment_id);

}
}
}
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
var consume_complete_segments_BANG_ = (function (){
while(true){
var temp__5825__auto__ = cljs.core.deref.call(null,terminator_STAR_);
if(cljs.core.truth_(temp__5825__auto__)){
var terminator = temp__5825__auto__;
var pending = cljs.core.deref.call(null,pending_STAR_);
var idx = pending.indexOf(terminator);
if(cljs.core.not_EQ_.call(null,(-1),idx)){
process_segment_BANG_.call(null,pending.slice((0),idx));

cljs.core.reset_BANG_.call(null,pending_STAR_,pending.slice((idx + (1))));

continue;
} else {
return null;
}
} else {
return null;
}
break;
}
});
try{var position = (0);
while(true){
var bytes_read = fs.readSync(fd,buffer,(0),chunk_size,position);
if((bytes_read === (0))){
cljs.core.swap_BANG_.call(null,pending_STAR_,cljs.core.str,decoder.end());

if((((cljs.core.deref.call(null,terminator_STAR_) == null)) && (cljs.core.seq.call(null,cljs.core.deref.call(null,pending_STAR_).trim())))){
throw cljs.core.ex_info.call(null,"Unable to detect the ISA segment terminator",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-segment-terminator","invalid-segment-terminator",1262584038)], null));
} else {
}

consume_complete_segments_BANG_.call(null);

if(cljs.core.seq.call(null,cljs.core.deref.call(null,pending_STAR_).trim())){
throw cljs.core.ex_info.call(null,"Input ends with an unterminated segment",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-segment-terminator","invalid-segment-terminator",1262584038)], null));
} else {
}

if(cljs.core.truth_(cljs.core.deref.call(null,in_isa_QMARK__STAR_))){
if(cljs.core.truth_(cljs.core.deref.call(null,in_transaction_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"Transaction is missing its SE trailer",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-se","missing-se",1394106028),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_),new cljs.core.Keyword(null,"transaction-index","transaction-index",727956549),cljs.core.deref.call(null,transaction_index_STAR_)], null));
} else {
if(cljs.core.truth_(cljs.core.deref.call(null,in_group_QMARK__STAR_))){
throw cljs.core.ex_info.call(null,"Functional group is missing its GE trailer",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-ge","missing-ge",-445925504),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));
} else {
throw cljs.core.ex_info.call(null,"ISA interchange is missing its IEA trailer",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-iea","missing-iea",1860407259),new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),cljs.core.deref.call(null,isa_index_STAR_)], null));

}
}
} else {
}

if((cljs.core.deref.call(null,isa_index_STAR_) === (0))){
throw cljs.core.ex_info.call(null,"EDI file contains no ISA interchange",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"empty-edi-file","empty-edi-file",958558062)], null));
} else {
}

return cljs.core.deref.call(null,acc_STAR_);
} else {
cljs.core.swap_BANG_.call(null,pending_STAR_,cljs.core.str,decoder.write(buffer.subarray((0),bytes_read)));

if((((cljs.core.deref.call(null,terminator_STAR_) == null)) && ((cljs.core.count.call(null,cljs.core.deref.call(null,pending_STAR_)) >= (106))))){
if(cljs.core._EQ_.call(null,"ISA",cljs.core.deref.call(null,pending_STAR_).slice((0),(3)))){
} else {
throw cljs.core.ex_info.call(null,"EDI input must begin with ISA",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"content-before-isa","content-before-isa",-1278592798)], null));
}

var terminator_632 = cljs.core.deref.call(null,pending_STAR_).charAt((105));
if(((cljs.core._EQ_.call(null,terminator_632,"")) || (cljs.core.boolean$.call(null,cljs.core.re_matches.call(null,/[A-Za-z0-9*\x00-\x20\x7F-\xFF]/,terminator_632))))){
throw cljs.core.ex_info.call(null,"Invalid ISA segment terminator",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"invalid-segment-terminator","invalid-segment-terminator",1262584038)], null));
} else {
}

cljs.core.reset_BANG_.call(null,terminator_STAR_,terminator_632);
} else {
}

consume_complete_segments_BANG_.call(null);

var G__633 = (position + bytes_read);
position = G__633;
continue;
}
break;
}
}finally {fs.closeSync(fd);
}}));

(org.kp.kpmc.io_node.reduce_ins_file.cljs$lang$maxFixedArity = 4);

/**
 * Write UTF-8 text to disk via Node.js fs.
 */
org.kp.kpmc.io_node.write_text = (function org$kp$kpmc$io_node$write_text(path,text){
return require("fs").writeFileSync(path,text,"utf8");
});
/**
 * Render data as pretty EDN text.
 */
org.kp.kpmc.io_node.to_edn_text = (function org$kp$kpmc$io_node$to_edn_text(data){
var sb__5795__auto__ = (new goog.string.StringBuffer());
var _STAR_print_newline_STAR__orig_val__634_638 = cljs.core._STAR_print_newline_STAR_;
var _STAR_print_fn_STAR__orig_val__635_639 = cljs.core._STAR_print_fn_STAR_;
var _STAR_print_newline_STAR__temp_val__636_640 = true;
var _STAR_print_fn_STAR__temp_val__637_641 = (function (x__5796__auto__){
return sb__5795__auto__.append(x__5796__auto__);
});
(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__temp_val__636_640);

(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__temp_val__637_641);

try{cljs.pprint.pprint.call(null,data);
}finally {(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__orig_val__635_639);

(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__orig_val__634_638);
}
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(sb__5795__auto__));
});

//# sourceMappingURL=io_node.js.map
