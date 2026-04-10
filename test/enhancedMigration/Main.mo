import Prim "mo:prim";

persistent actor {
    let a : Nat;
    var b : Text;
    let c : Bool;

    public func check() : async () {
        Prim.debugPrint(debug_show { a; b; c });
    };
};
