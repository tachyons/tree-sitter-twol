/**
 * @file Tree-sitter grammar for TwoL (Two-Level Morphology rules)
 *
 * TwoL is a formalism for writing two-level phonological/morphological rules,
 * used in tools like hfst-twolc and the Helsinki Finite-State Toolkit (HFST).
 *
 * A TwoL source file consists of:
 *   - Alphabet declaration
 *   - Diacritics declaration (optional)
 *   - Sets declarations
 *   - Definitions declarations
 *   - Rules section
 *
 * Rule operators:
 *   =>    right-arrow (context restriction)
 *   <=    left-arrow  (lexical coercion)
 *   <=>   left/right-arrow (both directions)
 *   /<=   prohibition
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "twol",

  extras: ($) => [$.comment, /\s/],

  word: ($) => $.identifier,

  conflicts: ($) => [
    // After a context's `;`, the parser must decide whether the next tokens
    // start another context for the same rule, or a new rule entirely.
    // Both can start with the same tokens (e.g. a symbol or `:` wildcard).
    [$.rule],
    
  ],

  rules: {
    // -----------------------------------------------------------------------
    // Top-level
    // -----------------------------------------------------------------------
    source_file: ($) =>
      seq(
        optional($.alphabet_section),
        optional($.diacritics_section),
        optional($.sets_section),
        optional($.definitions_section),
        optional($.rules_section)
      ),

    // -----------------------------------------------------------------------
    // Alphabet section
    // -----------------------------------------------------------------------
    alphabet_section: ($) =>
      seq(
        field("keyword", $.alphabet_keyword),
        repeat($.alphabet_entry),
        ";"
      ),

    alphabet_keyword: (_) => "Alphabet",

    alphabet_entry: ($) =>
      choice(
        $.pair,    // e.g.  N:m  k:0  0:i
        $.symbol   // e.g.  a  b  ä  %0
      ),

    // -----------------------------------------------------------------------
    // Diacritics section
    // -----------------------------------------------------------------------
    diacritics_section: ($) =>
      seq(
        field("keyword", $.diacritics_keyword),
        repeat($.symbol),
        ";"
      ),

    diacritics_keyword: (_) => "Diacritics",

    // -----------------------------------------------------------------------
    // Sets section
    // -----------------------------------------------------------------------
    sets_section: ($) =>
      seq(
        field("keyword", $.sets_keyword),
        repeat1($.set_definition)
      ),

    sets_keyword: (_) => "Sets",

    set_definition: ($) =>
      seq(
        field("name", $.identifier),
        "=",
        repeat1(choice($.pair, $.symbol)),
        ";"
      ),

    // -----------------------------------------------------------------------
    // Definitions section
    // -----------------------------------------------------------------------
    definitions_section: ($) =>
      seq(
        field("keyword", $.definitions_keyword),
        repeat1($.named_definition)
      ),

    definitions_keyword: (_) => "Definitions",

    named_definition: ($) =>
      seq(
        field("name", $.identifier),
        "=",
        field("value", $.regex),
        ";"
      ),

    // -----------------------------------------------------------------------
    // Rules section
    // -----------------------------------------------------------------------
    rules_section: ($) =>
      seq(
        field("keyword", $.rules_keyword),
        repeat($.rule)
      ),

    rules_keyword: (_) => "Rules",

    // A rule:  ["name"] center OP  L _ R ;  [L _ R ;] ...
    rule: ($) =>
      seq(
        optional(field("name", $.rule_name)),
        field("center", $.rule_center),
        field("operator", $.rule_operator),
        field("context", $.context),
        repeat($.extra_context)
      ),

    // Rule name is a double-quoted string
    rule_name: (_) => /"[^"]*"/,

    // Center: one or more center_atoms joined by |
    rule_center: ($) =>
      seq(
        $.center_atom,
        repeat(seq("|", $.center_atom))
      ),

    // A center atom is a pair (a:b), a right-wildcard (a:), a left-wildcard (:b), or ?
    center_atom: ($) =>
      choice(
        $.pair,
        $.right_wildcard,
        $.left_wildcard,
        $.any_pair
      ),

    rule_operator: (_) =>
      token(choice(
        "<=>",
        "=>",
        "<=",
        "/<=",
        "/=>",
      )),

    // Primary context: left_regex _ right_regex ;
    context: ($) =>
      seq(
        field("left", optional($.regex)),
        "_",
        field("right", optional($.regex)),
        ";"
      ),

    // Additional context within the same rule (same structure, lower precedence)
    extra_context: ($) =>
      prec(-1, seq(
        field("left", optional($.regex)),
        "_",
        field("right", optional($.regex)),
        ";"
      )),

    // -----------------------------------------------------------------------
    // Regular expressions
    // -----------------------------------------------------------------------
    regex: ($) => $.union_expr,

    union_expr: ($) =>
      choice(
        prec.left(1, seq($.union_expr, "|", $.union_expr)),
        prec.left(1, seq($.union_expr, "&", $.union_expr)),
        prec.left(1, seq($.union_expr, "-", $.union_expr)),
        $.concat_expr
      ),

    concat_expr: ($) =>
      choice(
        prec.left(2, seq($.concat_expr, $.postfix_expr)),
        $.postfix_expr
      ),

    postfix_expr: ($) =>
      choice(
        prec(3, seq($.prefix_expr, "*")),
        prec(3, seq($.prefix_expr, "+")),
        prec(3, seq($.prefix_expr, "?")),
        prec(3, seq($.prefix_expr, /\^[0-9]+/)),
        $.prefix_expr
      ),

    prefix_expr: ($) =>
      choice(
        seq("~", $.primary_expr),    // negation
        seq("\\", $.primary_expr),   // term-complement
        seq("$.", $.primary_expr),   // exact containment (must come before $)
        seq("$", $.primary_expr),    // containment
        $.primary_expr
      ),

    primary_expr: ($) =>
      choice(
        $.grouped_expr,
        $.optional_expr,
        $.pair,
        $.any_pair,
        $.left_wildcard,
        $.right_wildcard,
        $.zero,
        $.boundary,
        $.identifier,   // set / definition reference
        $.symbol
      ),

    grouped_expr: ($) =>
      seq("[", $.regex, "]"),

    optional_expr: ($) =>
      seq("(", $.regex, ")"),

    // -----------------------------------------------------------------------
    // Pairs and wildcards
    // -----------------------------------------------------------------------

    // Explicit pair:  a:b  N:m  k:0  0:i
    pair: ($) =>
      prec(10, seq(
        field("input", choice($.symbol, $.zero)),
        ":",
        field("output", choice($.symbol, $.zero))
      )),

    // ?  or  ?:?
    any_pair: (_) =>
      token(choice("?:?", "?")),

    // :a  — output-side wildcard (any pair with output a)
    left_wildcard: ($) =>
      prec(4, seq(":", field("output", choice($.symbol, $.zero, $.identifier)))),

    // a:  — input-side wildcard (any pair with input a)
    right_wildcard: ($) =>
      prec(4, seq(field("input", choice($.symbol, $.zero)), ":")),

    // -----------------------------------------------------------------------
    // Symbols
    // -----------------------------------------------------------------------
    symbol: ($) =>
      choice(
        $.bare_symbol,
        $.quoted_symbol   // %-escaped: %0  %.  %#  %{  %}  etc.
      ),

    // Non-whitespace, non-metacharacter run (not starting with digit or _)
    bare_symbol: (_) =>
      token(/[^\s:;=|&~()\[\]*+?<>/\\%"!#{}0-9_][^\s:;=|&~()\[\]*+?<>/\\%"!#{}]*/),

    // %-quoted character: %0  %.  %#  etc.
    quoted_symbol: (_) =>
      token(/%[^\s]/),

    // Epsilon / null symbol
    zero: (_) => "0",

    // Word boundary
    boundary: (_) => ".#.",

    // -----------------------------------------------------------------------
    // Identifiers (set names, definition names, rule variables)
    // -----------------------------------------------------------------------
    identifier: (_) => /[A-Za-z_][A-Za-z0-9_-]*/,

    // -----------------------------------------------------------------------
    // Comments  !  or  !!
    // -----------------------------------------------------------------------
    comment: (_) =>
      token(seq("!", /[^\n]*/))
  }
});
