import Map "mo:core/Map";

let map = Map.empty<Text, Nat>();

func e1() { Map. };
func e2() { Map.a };
func e3() { Map.ad };

func let1() { let _ = Map. };
func let2() { let _ = Map.a };
func let3() { let _ = Map.ad };

func call10() { Map.map(Map.) };
func call11() { Map.map(Map., func(x) { x }) };
func call20() { Map.map(Map.a) };
func call21() { Map.map(Map.a, func(x) { x }) };
func call30() { Map.map(Map.ad) };
func call31() { Map.map(Map.ad, func(x) { x }) };

func dotCall10() { Map..map };
func dotCall11() { Map..map(func(x) { x }) };
func dotCall20() { Map.a.map };
func dotCall21() { Map.a.map(func(x) { x }) };
func dotCall30() { Map.ad.map };
func dotCall31() { Map.ad.map(func(x) { x }) };
