// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.structural_validation');
goog.require('cljs.core');
goog.require('clojure.set');
goog.require('org.kp.kpmc.companion_rules');
org.kp.kpmc.structural_validation.member_name_loops = new cljs.core.PersistentArrayMap(null, 7, ["IL","2100A","70","2100B","31","2100C","36","2100D","M8","2100E","S3","2100F","CX","2100G"], null);
org.kp.kpmc.structural_validation.header_name_loops = new cljs.core.PersistentArrayMap(null, 3, ["P5","1000A","IN","1000B","TV","1000C"], null);
org.kp.kpmc.structural_validation.loop_path = (function org$kp$kpmc$structural_validation$loop_path(loop_name){
var G__2413 = loop_name;
switch (G__2413) {
case "1000A":
case "1000B":
case "1000C":
return new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [loop_name], null);

break;
case "2000":
return new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000"], null);

break;
case "2100A":
case "2100B":
case "2100C":
case "2100D":
case "2100E":
case "2100F":
case "2100G":
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000",loop_name], null);

break;
case "2200":
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2200"], null);

break;
case "2300":
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2300"], null);

break;
case "2310":
return new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2300","2310"], null);

break;
case "2320":
return new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2300","2320"], null);

break;
case "2330":
return new cljs.core.PersistentVector(null, 4, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2300","2320","2330"], null);

break;
case "2700":
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2700"], null);

break;
case "2710":
return new cljs.core.PersistentVector(null, 3, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2700","2710"], null);

break;
case "2750":
return new cljs.core.PersistentVector(null, 4, 5, cljs.core.PersistentVector.EMPTY_NODE, ["2000","2700","2710","2750"], null);

break;
default:
return null;

}
});
org.kp.kpmc.structural_validation.resolution = (function org$kp$kpmc$structural_validation$resolution(loop_name,reason,confidence){
return new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),loop_name,new cljs.core.Keyword(null,"loop-path","loop-path",100821809),org.kp.kpmc.structural_validation.loop_path.call(null,loop_name),new cljs.core.Keyword(null,"reason","reason",-2070751759),reason,new cljs.core.Keyword(null,"confidence","confidence",-2080269669),confidence], null);
});
org.kp.kpmc.structural_validation.advance = (function org$kp$kpmc$structural_validation$advance(state,segment_id,values){
var qualifier = cljs.core.first.call(null,values);
var current_loop = new cljs.core.Keyword(null,"current-loop","current-loop",-252244227).cljs$core$IFn$_invoke$arity$1(state);
var member_QMARK_ = new cljs.core.Keyword(null,"member?","member?",486668360).cljs$core$IFn$_invoke$arity$1(state);
var reporting_QMARK_ = new cljs.core.Keyword(null,"reporting?","reporting?",1069043499).cljs$core$IFn$_invoke$arity$1(state);
if(cljs.core._EQ_.call(null,segment_id,"BGN")){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),null,new cljs.core.Keyword(null,"member?","member?",486668360),false,new cljs.core.Keyword(null,"reporting?","reporting?",1069043499),false),org.kp.kpmc.structural_validation.resolution.call(null,null,new cljs.core.Keyword(null,"transaction-reset","transaction-reset",1413598337),new cljs.core.Keyword(null,"structural","structural",477822803))], null);
} else {
if(((cljs.core.not.call(null,member_QMARK_)) && (cljs.core._EQ_.call(null,segment_id,"N1")))){
var next_loop = cljs.core.get.call(null,org.kp.kpmc.structural_validation.header_name_loops,qualifier);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),next_loop),org.kp.kpmc.structural_validation.resolution.call(null,next_loop,new cljs.core.Keyword(null,"header-entity-qualifier","header-entity-qualifier",-2013056791),new cljs.core.Keyword(null,"qualifier","qualifier",125841738))], null);
} else {
if(cljs.core._EQ_.call(null,segment_id,"INS")){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2000",new cljs.core.Keyword(null,"member?","member?",486668360),true,new cljs.core.Keyword(null,"reporting?","reporting?",1069043499),false),org.kp.kpmc.structural_validation.resolution.call(null,"2000",new cljs.core.Keyword(null,"subscriber-start","subscriber-start",2091068773),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core.not.call(null,member_QMARK_)){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [state,org.kp.kpmc.structural_validation.resolution.call(null,null,new cljs.core.Keyword(null,"transaction-preamble","transaction-preamble",466620022),new cljs.core.Keyword(null,"inherited","inherited",172133303))], null);
} else {
if(((cljs.core._EQ_.call(null,segment_id,"LS")) && (cljs.core._EQ_.call(null,qualifier,"2700")))){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2700",new cljs.core.Keyword(null,"reporting?","reporting?",1069043499),true),org.kp.kpmc.structural_validation.resolution.call(null,"2700",new cljs.core.Keyword(null,"reporting-loop-start","reporting-loop-start",-643007373),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = reporting_QMARK_;
if(cljs.core.truth_(and__5140__auto__)){
return cljs.core._EQ_.call(null,segment_id,"LE");
} else {
return and__5140__auto__;
}
})())){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2000",new cljs.core.Keyword(null,"reporting?","reporting?",1069043499),false),org.kp.kpmc.structural_validation.resolution.call(null,"2700",new cljs.core.Keyword(null,"reporting-loop-end","reporting-loop-end",656751284),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = reporting_QMARK_;
if(cljs.core.truth_(and__5140__auto__)){
return cljs.core._EQ_.call(null,segment_id,"LX");
} else {
return and__5140__auto__;
}
})())){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2710"),org.kp.kpmc.structural_validation.resolution.call(null,"2710",new cljs.core.Keyword(null,"reporting-category-start","reporting-category-start",1557105380),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = reporting_QMARK_;
if(cljs.core.truth_(and__5140__auto__)){
return cljs.core._EQ_.call(null,segment_id,"N1");
} else {
return and__5140__auto__;
}
})())){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2750"),org.kp.kpmc.structural_validation.resolution.call(null,"2750",new cljs.core.Keyword(null,"reporting-category-entity","reporting-category-entity",1028198920),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core._EQ_.call(null,segment_id,"DSB")){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2200"),org.kp.kpmc.structural_validation.resolution.call(null,"2200",new cljs.core.Keyword(null,"disability-loop-start","disability-loop-start",627517585),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core._EQ_.call(null,segment_id,"HD")){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2300"),org.kp.kpmc.structural_validation.resolution.call(null,"2300",new cljs.core.Keyword(null,"coverage-loop-start","coverage-loop-start",1919594239),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(cljs.core._EQ_.call(null,segment_id,"COB")){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2320"),org.kp.kpmc.structural_validation.resolution.call(null,"2320",new cljs.core.Keyword(null,"cob-loop-start","cob-loop-start",1479873172),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(((cljs.core._EQ_.call(null,segment_id,"LX")) && (cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 2, ["2300",null,"2310",null], null), null),current_loop)))){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2310"),org.kp.kpmc.structural_validation.resolution.call(null,"2310",new cljs.core.Keyword(null,"provider-loop-start","provider-loop-start",1236045152),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(((cljs.core._EQ_.call(null,segment_id,"NM1")) && (cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 2, ["2330",null,"2320",null], null), null),current_loop)))){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),"2330"),org.kp.kpmc.structural_validation.resolution.call(null,"2330",new cljs.core.Keyword(null,"cob-entity-start","cob-entity-start",1489806864),new cljs.core.Keyword(null,"structural-starter","structural-starter",1394466071))], null);
} else {
if(((cljs.core._EQ_.call(null,segment_id,"NM1")) && (cljs.core._EQ_.call(null,current_loop,"2310")))){
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [state,org.kp.kpmc.structural_validation.resolution.call(null,"2310",new cljs.core.Keyword(null,"provider-entity","provider-entity",563067349),new cljs.core.Keyword(null,"inherited","inherited",172133303))], null);
} else {
if(cljs.core._EQ_.call(null,segment_id,"NM1")){
var next_loop = (function (){var or__5142__auto__ = cljs.core.get.call(null,org.kp.kpmc.structural_validation.member_name_loops,qualifier);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "2100A";
}
})();
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [cljs.core.assoc.call(null,state,new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),next_loop),org.kp.kpmc.structural_validation.resolution.call(null,next_loop,new cljs.core.Keyword(null,"member-entity-qualifier","member-entity-qualifier",550455550),new cljs.core.Keyword(null,"qualifier","qualifier",125841738))], null);
} else {
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [state,org.kp.kpmc.structural_validation.resolution.call(null,current_loop,new cljs.core.Keyword(null,"current-structural-loop","current-structural-loop",-18598293),new cljs.core.Keyword(null,"inherited","inherited",172133303))], null);

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
 * Create a stateful resolver for one ordered 834 validation walk.
 * The returned function accepts reset and segment events and records decisions.
 */
org.kp.kpmc.structural_validation.make_834_loop_resolver = (function org$kp$kpmc$structural_validation$make_834_loop_resolver(var_args){
var G__2416 = arguments.length;
switch (G__2416) {
case 0:
return org.kp.kpmc.structural_validation.make_834_loop_resolver.cljs$core$IFn$_invoke$arity$0();

break;
case 1:
return org.kp.kpmc.structural_validation.make_834_loop_resolver.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.structural_validation.make_834_loop_resolver.cljs$core$IFn$_invoke$arity$0 = (function (){
return org.kp.kpmc.structural_validation.make_834_loop_resolver.call(null,null);
}));

(org.kp.kpmc.structural_validation.make_834_loop_resolver.cljs$core$IFn$_invoke$arity$1 = (function (decisions_STAR_){
var state_STAR_ = cljs.core.atom.call(null,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),null,new cljs.core.Keyword(null,"member?","member?",486668360),false,new cljs.core.Keyword(null,"reporting?","reporting?",1069043499),false,new cljs.core.Keyword(null,"segment-index","segment-index",-1287888936),(0)], null));
return (function (p__2417){
var map__2418 = p__2417;
var map__2418__$1 = cljs.core.__destructure_map.call(null,map__2418);
var event = cljs.core.get.call(null,map__2418__$1,new cljs.core.Keyword(null,"event","event",301435442));
var scope = cljs.core.get.call(null,map__2418__$1,new cljs.core.Keyword(null,"scope","scope",-439358418));
var segment_id = cljs.core.get.call(null,map__2418__$1,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590));
var values = cljs.core.get.call(null,map__2418__$1,new cljs.core.Keyword(null,"values","values",372645556));
if(cljs.core._EQ_.call(null,event,new cljs.core.Keyword(null,"reset","reset",-800929946))){
cljs.core.reset_BANG_.call(null,state_STAR_,new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"current-loop","current-loop",-252244227),null,new cljs.core.Keyword(null,"member?","member?",486668360),false,new cljs.core.Keyword(null,"reporting?","reporting?",1069043499),false,new cljs.core.Keyword(null,"segment-index","segment-index",-1287888936),(0)], null));

return new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"loop-name","loop-name",468086403),null,new cljs.core.Keyword(null,"loop-path","loop-path",100821809),null,new cljs.core.Keyword(null,"reason","reason",-2070751759),new cljs.core.Keyword(null,"reset","reset",-800929946),new cljs.core.Keyword(null,"scope","scope",-439358418),scope,new cljs.core.Keyword(null,"confidence","confidence",-2080269669),new cljs.core.Keyword(null,"structural","structural",477822803)], null);
} else {
var previous = cljs.core.deref.call(null,state_STAR_);
var vec__2419 = org.kp.kpmc.structural_validation.advance.call(null,previous,segment_id,values);
var next_state = cljs.core.nth.call(null,vec__2419,(0),null);
var result = cljs.core.nth.call(null,vec__2419,(1),null);
var segment_index = (new cljs.core.Keyword(null,"segment-index","segment-index",-1287888936).cljs$core$IFn$_invoke$arity$1(previous) + (1));
var next_state__$1 = cljs.core.assoc.call(null,next_state,new cljs.core.Keyword(null,"segment-index","segment-index",-1287888936),segment_index);
var decision = cljs.core.assoc.call(null,result,new cljs.core.Keyword(null,"segment-index","segment-index",-1287888936),segment_index,new cljs.core.Keyword(null,"segment-id","segment-id",1810133590),segment_id,new cljs.core.Keyword(null,"qualifier","qualifier",125841738),cljs.core.first.call(null,values),new cljs.core.Keyword(null,"previous-loop","previous-loop",170002024),new cljs.core.Keyword(null,"current-loop","current-loop",-252244227).cljs$core$IFn$_invoke$arity$1(previous));
cljs.core.reset_BANG_.call(null,state_STAR_,next_state__$1);

if(cljs.core.truth_(decisions_STAR_)){
cljs.core.swap_BANG_.call(null,decisions_STAR_,cljs.core.conj,decision);
} else {
}

return decision;
}
});
}));

(org.kp.kpmc.structural_validation.make_834_loop_resolver.cljs$lang$maxFixedArity = 1);

/**
 * Run the existing rules through an independent 834 structural-loop resolver.
 */
org.kp.kpmc.structural_validation.run_structural_rule_harness = (function org$kp$kpmc$structural_validation$run_structural_rule_harness(var_args){
var G__2424 = arguments.length;
switch (G__2424) {
case 2:
return org.kp.kpmc.structural_validation.run_structural_rule_harness.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 3:
return org.kp.kpmc.structural_validation.run_structural_rule_harness.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.structural_validation.run_structural_rule_harness.cljs$core$IFn$_invoke$arity$2 = (function (companion_csv,edi_file){
return org.kp.kpmc.structural_validation.run_structural_rule_harness.call(null,companion_csv,edi_file,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.structural_validation.run_structural_rule_harness.cljs$core$IFn$_invoke$arity$3 = (function (companion_csv,edi_file,opts){
if(new cljs.core.Keyword(null,"streaming?","streaming?",-88445658).cljs$core$IFn$_invoke$arity$1(opts) === true){
throw cljs.core.ex_info.call(null,"Structural 834 evaluation does not yet support streaming mode",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"unsupported-structural-streaming","unsupported-structural-streaming",-921511247)], null));
} else {
}

var decisions_STAR_ = cljs.core.atom.call(null,cljs.core.PersistentVector.EMPTY);
var resolver = org.kp.kpmc.structural_validation.make_834_loop_resolver.call(null,decisions_STAR_);
var result = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,cljs.core.assoc.call(null,opts,new cljs.core.Keyword(null,"structural-loop-resolver","structural-loop-resolver",-1220853782),resolver));
var evaluation = new cljs.core.PersistentArrayMap(null, 4, [new cljs.core.Keyword(null,"mode","mode",654403691),new cljs.core.Keyword(null,"structural-834","structural-834",-581993192),new cljs.core.Keyword(null,"version","version",425292698),(1),new cljs.core.Keyword(null,"decision-count","decision-count",-173304041),cljs.core.count.call(null,cljs.core.deref.call(null,decisions_STAR_)),new cljs.core.Keyword(null,"decisions","decisions",239322436),cljs.core.deref.call(null,decisions_STAR_)], null);
return cljs.core.update.call(null,cljs.core.assoc.call(null,result,new cljs.core.Keyword(null,"structural-evaluation","structural-evaluation",1284846932),evaluation),new cljs.core.Keyword(null,"report","report",1394055010),cljs.core.assoc,new cljs.core.Keyword(null,"loop-resolution","loop-resolution",-1639061591),evaluation);
}));

(org.kp.kpmc.structural_validation.run_structural_rule_harness.cljs$lang$maxFixedArity = 3);

org.kp.kpmc.structural_validation.finding_key = (function org$kp$kpmc$structural_validation$finding_key(finding){
return cljs.core.select_keys.call(null,finding,new cljs.core.PersistentVector(null, 7, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"isa-index","isa-index",1189721564),new cljs.core.Keyword(null,"subscriber-index","subscriber-index",326386903),new cljs.core.Keyword(null,"segment","segment",-964921196),new cljs.core.Keyword(null,"ref","ref",1289896967),new cljs.core.Keyword(null,"failed-value","failed-value",-645422655),new cljs.core.Keyword(null,"loop-name","loop-name",468086403),new cljs.core.Keyword(null,"loop-description","loop-description",120734501)], null));
});
/**
 * Run legacy and structural validation and report finding-level differences.
 */
org.kp.kpmc.structural_validation.compare_rule_harnesses = (function org$kp$kpmc$structural_validation$compare_rule_harnesses(var_args){
var G__2427 = arguments.length;
switch (G__2427) {
case 2:
return org.kp.kpmc.structural_validation.compare_rule_harnesses.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
case 3:
return org.kp.kpmc.structural_validation.compare_rule_harnesses.cljs$core$IFn$_invoke$arity$3((arguments[(0)]),(arguments[(1)]),(arguments[(2)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(org.kp.kpmc.structural_validation.compare_rule_harnesses.cljs$core$IFn$_invoke$arity$2 = (function (companion_csv,edi_file){
return org.kp.kpmc.structural_validation.compare_rule_harnesses.call(null,companion_csv,edi_file,cljs.core.PersistentArrayMap.EMPTY);
}));

(org.kp.kpmc.structural_validation.compare_rule_harnesses.cljs$core$IFn$_invoke$arity$3 = (function (companion_csv,edi_file,opts){
var legacy = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,opts);
var structural = org.kp.kpmc.structural_validation.run_structural_rule_harness.call(null,companion_csv,edi_file,opts);
var legacy_findings = cljs.core.set.call(null,cljs.core.map.call(null,org.kp.kpmc.structural_validation.finding_key,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(legacy)));
var structural_findings = cljs.core.set.call(null,cljs.core.map.call(null,org.kp.kpmc.structural_validation.finding_key,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(structural)));
var shared = clojure.set.intersection.call(null,legacy_findings,structural_findings);
return new cljs.core.PersistentArrayMap(null, 6, [new cljs.core.Keyword(null,"summary","summary",380847952),new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"legacy-finding-count","legacy-finding-count",126346631),cljs.core.count.call(null,legacy_findings),new cljs.core.Keyword(null,"structural-finding-count","structural-finding-count",996831331),cljs.core.count.call(null,structural_findings),new cljs.core.Keyword(null,"shared-finding-count","shared-finding-count",-660704289),cljs.core.count.call(null,shared),new cljs.core.Keyword(null,"legacy-only-count","legacy-only-count",-254732059),cljs.core.count.call(null,clojure.set.difference.call(null,legacy_findings,shared)),new cljs.core.Keyword(null,"structural-only-count","structural-only-count",-1745748266),cljs.core.count.call(null,clojure.set.difference.call(null,structural_findings,shared))], null),new cljs.core.Keyword(null,"legacy-only","legacy-only",-1345096346),cljs.core.vec.call(null,clojure.set.difference.call(null,legacy_findings,shared)),new cljs.core.Keyword(null,"structural-only","structural-only",650508551),cljs.core.vec.call(null,clojure.set.difference.call(null,structural_findings,shared)),new cljs.core.Keyword(null,"shared","shared",-384145993),cljs.core.vec.call(null,shared),new cljs.core.Keyword(null,"legacy","legacy",1434943289),legacy,new cljs.core.Keyword(null,"structural","structural",477822803),structural], null);
}));

(org.kp.kpmc.structural_validation.compare_rule_harnesses.cljs$lang$maxFixedArity = 3);


//# sourceMappingURL=structural_validation.js.map
