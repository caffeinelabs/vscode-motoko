import LibB "./libB";

module {
    public func empty() : LibB.Store { { store = [] } };

    public func fromLibA(self : LibB.Store, _value : Nat) : LibB.Store {
        self;
    };
};
