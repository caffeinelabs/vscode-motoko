import List "mo:core/List";
import Array "mo:core/Array";

actor A {
    let a : List.List<Int> = List.empty();
    let b : [Int] = Array.repeat(42, 2);
    let c : List
           .List<Int> = List.empty();
};
