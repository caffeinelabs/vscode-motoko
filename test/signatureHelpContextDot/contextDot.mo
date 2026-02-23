import Lib "./Lib";
import Map "mo:core/Map";
import Array "mo:core/Array";

let obj : Lib.MyObj = { data = 42 };
let m = Map.empty<Text, Nat>();
let arr : [Nat] = [1, 2, 3];

let _ = obj.f1();
let _ = obj.f2(10);
let _ = obj.f3("hello", 3);
let _ = m.size();
let _ = m.get("mykey");
let _ = m.add("mykey", 99);
let _ = arr.find(func (x : Nat) : Bool { x > 0 });
