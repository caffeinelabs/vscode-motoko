module {
    /// Documentation for foo.
    public func foo(self : Text) : Text {
        self;
    };

    /// Documentation for foo1.
    public func foo1(self : Text, arg1 : [Nat]) : Text {
        self;
    };

    /// Documentation for foo2.
    public func foo2(self : Text, arg1 : [Nat], arg2 : ?{ a : Nat }) : Text {
        self;
    };
};
