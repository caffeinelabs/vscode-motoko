import LibB "./libB";

module {
    public func empty() : LibB.Store { { store = [] } };

    /// Documentation for fromLibA
    public func fromLibA(self : LibB.Store, _value : Nat) : LibB.Store {
        self;
    };
};
