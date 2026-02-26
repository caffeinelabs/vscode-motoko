import Text "mo:core/Text";
import Int "mo:core/Int";
import Blob "mo:core/Blob";

import Lib1 "lib1";
import Lib "lib";

func greet(fname : Text) : Text {
  let x = Lib.f(1, Int.toText(2));
  return Text.concat("Hello, ", fname) # x;
};

greet(Lib1.world());
