module {
  public func migration(old : { a : Nat; b : Text; c : Bool }) : { counter : Nat; name : Text } {
    { counter = old.a; name = old.b };
  };
};
