let Package = { name : Text, version : Text, repo : Text, dependencies : List Text }

in [ { name = "core"
  , repo = "https://github.com/caffeinelabs/motoko-core"
  , version = "main"
  , dependencies = [] : List Text
  }
] : List Package
