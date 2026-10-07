import List "mo:core/List";
import ImportMe "import_me";

type record = { field : Nat };

func _test() : Nat {
    let value : record = { field = ImportMe.reference_me() };
    value.field
};

let _list : List.List<Nat> = List.empty();
