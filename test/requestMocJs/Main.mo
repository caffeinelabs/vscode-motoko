import Nat "mo:core/Nat";

actor {
    let number = 123;
    let rendered = Nat.toText(number);

    public func wrong() : async Text {
        123;
    };

    public func completionTarget() : async Text {
        let _ = numb;
        rendered
    };
};
