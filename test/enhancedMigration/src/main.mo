import Prim "mo:prim";

actor {
    let counter : Nat;
    let name : Text;

    public func check() : async () {
        Prim.debugPrint(debug_show { counter; name });
    };
};
