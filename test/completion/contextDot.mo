import Map "mo:core/Map";

let obj = Map.empty<Text, Nat>();

func e1() { obj. };
func e2() { obj.a };
func e3() { obj.ad };

func let1() { let _ = obj. };
func let2() { let _ = obj.a };
func let3() { let _ = obj.ad };

func call10() { Map.map(obj.) };
func call11() { Map.map(obj., func(x) { x }) };
func call20() { Map.map(obj.a) };
func call21() { Map.map(obj.a, func(x) { x }) };
func call30() { Map.map(obj.ad) };
func call31() { Map.map(obj.ad, func(x) { x }) };

func dotCall10() { obj..map };
func dotCall11() { obj..map(func(x) { x }) };
func dotCall20() { obj.a.map };
func dotCall21() { obj.a.map(func(x) { x }) };
func dotCall30() { obj.ad.map };
func dotCall31() { obj.ad.map(func(x) { x }) };

func static1() { Map.empty<Text, Nat>(). };
func static2() { Map.empty<Text, Nat>().a };
func static3() { Map.empty<Text, Nat>().ad };

func paren1() { (obj). };
func paren2() { (obj).a };
func paren3() { (obj).ad };

func chain1() { obj.filter(func(k, v) { true }). };
func chain2() { obj.filter(func(k, v) { true }).a };
func chain3() { obj.filter(func(k, v) { true }).ad };

let objs = [obj];
func index1() { objs[0]. };
func index2() { objs[0].a };
func index3() { objs[0].ad };
