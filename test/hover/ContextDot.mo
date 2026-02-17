import Map "mo:core/Map";
import Text "mo:core/Text";
import Lib "./Lib";

let obj = Map.empty<Text, Nat>();

// Complete context dot method calls for hover testing
let _size = obj.size();
let _result = obj.get("key");

let _foo = "hello".foo();
