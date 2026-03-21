import Map "mo:core/Map";

let obj = Map.empty<Text, Nat>();

func e1() { obj };
func let1() { let _ = obj };
func static1() { Map.empty<Text, Nat>() };
func paren1() { (obj) };
func chain1() { obj.filter(func(k, v) { true }) };
func complexReceiver0() { Map.filter(obj, func(k, v) { true }) };
func complexReceiverL() { let _ = Map.filter(obj, func(k, v) { true }) };

let objs = [obj];
func index1() { objs[0] };
