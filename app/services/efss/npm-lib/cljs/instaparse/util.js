// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('instaparse.util');
goog.require('cljs.core');
instaparse.util.throw_runtime_exception = (function instaparse$util$throw_runtime_exception(var_args){
var args__5882__auto__ = [];
var len__5876__auto___541 = arguments.length;
var i__5877__auto___542 = (0);
while(true){
if((i__5877__auto___542 < len__5876__auto___541)){
args__5882__auto__.push((arguments[i__5877__auto___542]));

var G__543 = (i__5877__auto___542 + (1));
i__5877__auto___542 = G__543;
continue;
} else {
}
break;
}

var argseq__5883__auto__ = ((((0) < args__5882__auto__.length))?(new cljs.core.IndexedSeq(args__5882__auto__.slice((0)),(0),null)):null);
return instaparse.util.throw_runtime_exception.cljs$core$IFn$_invoke$arity$variadic(argseq__5883__auto__);
});

(instaparse.util.throw_runtime_exception.cljs$core$IFn$_invoke$arity$variadic = (function (message){
var text = cljs.core.apply.call(null,cljs.core.str,message);
throw text;
}));

(instaparse.util.throw_runtime_exception.cljs$lang$maxFixedArity = (0));

/** @this {Function} */
(instaparse.util.throw_runtime_exception.cljs$lang$applyTo = (function (seq540){
var self__5862__auto__ = this;
return self__5862__auto__.cljs$core$IFn$_invoke$arity$variadic(cljs.core.seq.call(null,seq540));
}));

instaparse.util.throw_illegal_argument_exception = (function instaparse$util$throw_illegal_argument_exception(var_args){
var args__5882__auto__ = [];
var len__5876__auto___545 = arguments.length;
var i__5877__auto___546 = (0);
while(true){
if((i__5877__auto___546 < len__5876__auto___545)){
args__5882__auto__.push((arguments[i__5877__auto___546]));

var G__547 = (i__5877__auto___546 + (1));
i__5877__auto___546 = G__547;
continue;
} else {
}
break;
}

var argseq__5883__auto__ = ((((0) < args__5882__auto__.length))?(new cljs.core.IndexedSeq(args__5882__auto__.slice((0)),(0),null)):null);
return instaparse.util.throw_illegal_argument_exception.cljs$core$IFn$_invoke$arity$variadic(argseq__5883__auto__);
});

(instaparse.util.throw_illegal_argument_exception.cljs$core$IFn$_invoke$arity$variadic = (function (message){
var text = cljs.core.apply.call(null,cljs.core.str,message);
throw text;
}));

(instaparse.util.throw_illegal_argument_exception.cljs$lang$maxFixedArity = (0));

/** @this {Function} */
(instaparse.util.throw_illegal_argument_exception.cljs$lang$applyTo = (function (seq544){
var self__5862__auto__ = this;
return self__5862__auto__.cljs$core$IFn$_invoke$arity$variadic(cljs.core.seq.call(null,seq544));
}));

instaparse.util.regexp_flags = (function instaparse$util$regexp_flags(re){
var G__548 = "";
var G__548__$1 = (cljs.core.truth_(re.ignoreCase)?(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(G__548)+"i"):G__548);
var G__548__$2 = (cljs.core.truth_(re.multiline)?(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(G__548__$1)+"m"):G__548__$1);
if(cljs.core.truth_(re.unicode)){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(G__548__$2)+"u");
} else {
return G__548__$2;
}
});

//# sourceMappingURL=util.js.map
