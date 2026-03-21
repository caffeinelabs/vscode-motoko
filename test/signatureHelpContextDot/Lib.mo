module {
    public type MyObj = { data : Nat };

    /// Returns the data value from the object.
    public func f1(self : MyObj) : Nat {
        self.data;
    };

    /// Adds amount to the data and returns the result.
    public func f2(self : MyObj, amount : Nat) : Nat {
        self.data + amount;
    };

    /// Combines text with the data, repeated count times.
    public func f3(self : MyObj, prefix : Text, count : Nat) : Text {
        prefix;
    };
};
