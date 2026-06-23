package tree_sitter_twol_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_twol "github.com/tree-sitter/tree-sitter-twol/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_twol.Language())
	if language == nil {
		t.Errorf("Error loading Twol grammar")
	}
}
