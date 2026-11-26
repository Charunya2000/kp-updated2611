// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('instaparse.failure');
goog.require('cljs.core');
goog.require('instaparse.print');
/**
 * Takes an index into text, and determines the line and column info
 */
instaparse.failure.index__GT_line_column = (function instaparse$failure$index__GT_line_column(index,text){
var line = (1);
var col = (1);
var counter = (0);
while(true){
if(cljs.core._EQ_.call(null,index,counter)){
return new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"line","line",212345235),line,new cljs.core.Keyword(null,"column","column",2078222095),col], null);
} else {
if(cljs.core._EQ_.call(null,"\n",cljs.core.get.call(null,text,counter))){
var G__1075 = (line + (1));
var G__1076 = (1);
var G__1077 = (counter + (1));
line = G__1075;
col = G__1076;
counter = G__1077;
continue;
} else {
var G__1078 = line;
var G__1079 = (col + (1));
var G__1080 = (counter + (1));
line = G__1078;
col = G__1079;
counter = G__1080;
continue;

}
}
break;
}
});
instaparse.failure.get_line = (function instaparse$failure$get_line(n,text){
var chars = cljs.core.seq.call(null,clojure.string.replace.call(null,text,"\r\n","\n"));
var n__$1 = n;
while(true){
if(cljs.core.empty_QMARK_.call(null,chars)){
return "";
} else {
if(cljs.core._EQ_.call(null,n__$1,(1))){
return cljs.core.apply.call(null,cljs.core.str,cljs.core.take_while.call(null,cljs.core.complement.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, ["\n",null], null), null)),chars));
} else {
if(cljs.core._EQ_.call(null,"\n",cljs.core.first.call(null,chars))){
var G__1081 = cljs.core.next.call(null,chars);
var G__1082 = (n__$1 - (1));
chars = G__1081;
n__$1 = G__1082;
continue;
} else {
var G__1083 = cljs.core.next.call(null,chars);
var G__1084 = n__$1;
chars = G__1083;
n__$1 = G__1084;
continue;

}
}
}
break;
}
});
/**
 * Creates string with caret at nth position, 1-based
 * and accounts for horizontal tabs which might change
 * the alignment of the '^' to the error location.
 */
instaparse.failure.marker = (function instaparse$failure$marker(text,n){
if(cljs.core.truth_((function (){var and__5140__auto__ = text;
if(cljs.core.truth_(and__5140__auto__)){
return cljs.core.integer_QMARK_.call(null,n);
} else {
return and__5140__auto__;
}
})())){
var marker_text = clojure.string.replace.call(null,text,/[^\s]/," ");
if((n <= (1))){
return "^";
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.subs.call(null,marker_text,(0),(n - (1))))+cljs.core.str.cljs$core$IFn$_invoke$arity$1("^"));
}
} else {
return null;
}
});
/**
 * Adds text, line, and column info to failure object.
 */
instaparse.failure.augment_failure = (function instaparse$failure$augment_failure(failure,text){
var lc = instaparse.failure.index__GT_line_column.call(null,new cljs.core.Keyword(null,"index","index",-1531685915).cljs$core$IFn$_invoke$arity$1(failure),text);
return cljs.core.merge.call(null,failure,lc,new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"text","text",-1790561697),instaparse.failure.get_line.call(null,new cljs.core.Keyword(null,"line","line",212345235).cljs$core$IFn$_invoke$arity$1(lc),text)], null));
});
/**
 * Provides special case for printing negative lookahead reasons
 */
instaparse.failure.print_reason = (function instaparse$failure$print_reason(r){
if(cljs.core.truth_(new cljs.core.Keyword(null,"NOT","NOT",-1689245341).cljs$core$IFn$_invoke$arity$1(r))){
cljs.core.print.call(null,"NOT ");

return cljs.core.print.call(null,new cljs.core.Keyword(null,"NOT","NOT",-1689245341).cljs$core$IFn$_invoke$arity$1(r));
} else {
if(cljs.core.truth_(new cljs.core.Keyword(null,"char-range","char-range",1443391389).cljs$core$IFn$_invoke$arity$1(r))){
return cljs.core.print.call(null,instaparse.print.char_range__GT_str.call(null,r));
} else {
if((r instanceof RegExp)){
return cljs.core.print.call(null,instaparse.print.regexp__GT_str.call(null,r));
} else {
return cljs.core.pr.call(null,r);

}
}
}
});
/**
 * Takes an augmented failure object and prints the error message
 */
instaparse.failure.pprint_failure = (function instaparse$failure$pprint_failure(p__1085){
var map__1086 = p__1085;
var map__1086__$1 = cljs.core.__destructure_map.call(null,map__1086);
var line = cljs.core.get.call(null,map__1086__$1,new cljs.core.Keyword(null,"line","line",212345235));
var column = cljs.core.get.call(null,map__1086__$1,new cljs.core.Keyword(null,"column","column",2078222095));
var text = cljs.core.get.call(null,map__1086__$1,new cljs.core.Keyword(null,"text","text",-1790561697));
var reason = cljs.core.get.call(null,map__1086__$1,new cljs.core.Keyword(null,"reason","reason",-2070751759));
cljs.core.println.call(null,(""+"Parse error at line "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(line)+", column "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(column)+":"));

cljs.core.println.call(null,text);

cljs.core.println.call(null,instaparse.failure.marker.call(null,text,column));

var full_reasons = cljs.core.distinct.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"expecting","expecting",-57706705),cljs.core.filter.call(null,new cljs.core.Keyword(null,"full","full",436801220),reason)));
var partial_reasons = cljs.core.distinct.call(null,cljs.core.map.call(null,new cljs.core.Keyword(null,"expecting","expecting",-57706705),cljs.core.filter.call(null,cljs.core.complement.call(null,new cljs.core.Keyword(null,"full","full",436801220)),reason)));
var total = (cljs.core.count.call(null,full_reasons) + cljs.core.count.call(null,partial_reasons));
if((total === (0))){
} else {
if(cljs.core._EQ_.call(null,(1),total)){
cljs.core.println.call(null,"Expected:");
} else {
cljs.core.println.call(null,"Expected one of:");

}
}

var seq__1087_1095 = cljs.core.seq.call(null,full_reasons);
var chunk__1088_1096 = null;
var count__1089_1097 = (0);
var i__1090_1098 = (0);
while(true){
if((i__1090_1098 < count__1089_1097)){
var r_1099 = cljs.core._nth.call(null,chunk__1088_1096,i__1090_1098);
instaparse.failure.print_reason.call(null,r_1099);

cljs.core.println.call(null," (followed by end-of-string)");


var G__1100 = seq__1087_1095;
var G__1101 = chunk__1088_1096;
var G__1102 = count__1089_1097;
var G__1103 = (i__1090_1098 + (1));
seq__1087_1095 = G__1100;
chunk__1088_1096 = G__1101;
count__1089_1097 = G__1102;
i__1090_1098 = G__1103;
continue;
} else {
var temp__5825__auto___1104 = cljs.core.seq.call(null,seq__1087_1095);
if(temp__5825__auto___1104){
var seq__1087_1105__$1 = temp__5825__auto___1104;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__1087_1105__$1)){
var c__5673__auto___1106 = cljs.core.chunk_first.call(null,seq__1087_1105__$1);
var G__1107 = cljs.core.chunk_rest.call(null,seq__1087_1105__$1);
var G__1108 = c__5673__auto___1106;
var G__1109 = cljs.core.count.call(null,c__5673__auto___1106);
var G__1110 = (0);
seq__1087_1095 = G__1107;
chunk__1088_1096 = G__1108;
count__1089_1097 = G__1109;
i__1090_1098 = G__1110;
continue;
} else {
var r_1111 = cljs.core.first.call(null,seq__1087_1105__$1);
instaparse.failure.print_reason.call(null,r_1111);

cljs.core.println.call(null," (followed by end-of-string)");


var G__1112 = cljs.core.next.call(null,seq__1087_1105__$1);
var G__1113 = null;
var G__1114 = (0);
var G__1115 = (0);
seq__1087_1095 = G__1112;
chunk__1088_1096 = G__1113;
count__1089_1097 = G__1114;
i__1090_1098 = G__1115;
continue;
}
} else {
}
}
break;
}

var seq__1091 = cljs.core.seq.call(null,partial_reasons);
var chunk__1092 = null;
var count__1093 = (0);
var i__1094 = (0);
while(true){
if((i__1094 < count__1093)){
var r = cljs.core._nth.call(null,chunk__1092,i__1094);
instaparse.failure.print_reason.call(null,r);

cljs.core.println.call(null);


var G__1116 = seq__1091;
var G__1117 = chunk__1092;
var G__1118 = count__1093;
var G__1119 = (i__1094 + (1));
seq__1091 = G__1116;
chunk__1092 = G__1117;
count__1093 = G__1118;
i__1094 = G__1119;
continue;
} else {
var temp__5825__auto__ = cljs.core.seq.call(null,seq__1091);
if(temp__5825__auto__){
var seq__1091__$1 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,seq__1091__$1)){
var c__5673__auto__ = cljs.core.chunk_first.call(null,seq__1091__$1);
var G__1120 = cljs.core.chunk_rest.call(null,seq__1091__$1);
var G__1121 = c__5673__auto__;
var G__1122 = cljs.core.count.call(null,c__5673__auto__);
var G__1123 = (0);
seq__1091 = G__1120;
chunk__1092 = G__1121;
count__1093 = G__1122;
i__1094 = G__1123;
continue;
} else {
var r = cljs.core.first.call(null,seq__1091__$1);
instaparse.failure.print_reason.call(null,r);

cljs.core.println.call(null);


var G__1124 = cljs.core.next.call(null,seq__1091__$1);
var G__1125 = null;
var G__1126 = (0);
var G__1127 = (0);
seq__1091 = G__1124;
chunk__1092 = G__1125;
count__1093 = G__1126;
i__1094 = G__1127;
continue;
}
} else {
return null;
}
}
break;
}
});

//# sourceMappingURL=failure.js.map
