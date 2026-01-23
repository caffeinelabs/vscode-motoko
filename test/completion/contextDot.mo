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
