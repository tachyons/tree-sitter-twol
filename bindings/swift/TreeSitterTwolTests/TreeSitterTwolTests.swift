import XCTest
import SwiftTreeSitter
import TreeSitterTwol

final class TreeSitterTwolTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_twol())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Twol grammar")
    }
}
