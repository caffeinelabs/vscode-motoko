import Map "mo:core/Map";
import Text "mo:core/Text";

let obj = Map.empty<Text, Nat>();

// Complete context dot method calls for hover testing
let _size = obj.size();
let _result = obj.get("key");
