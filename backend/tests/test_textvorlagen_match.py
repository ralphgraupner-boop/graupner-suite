"""
Tests für die neue Keyword-Match-Engine in module_textvorlagen.
"""
import sys
import pathlib
import asyncio

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from module_textvorlagen.routes import (
    _normalize_keywords, _tokenize_text, _count_keyword_hits,
)


def test_normalize_keywords_string_und_liste():
    assert _normalize_keywords("schiebetür, fliegengitter , schloss") == ["schiebetür", "fliegengitter", "schloss"]
    assert _normalize_keywords(["A", " B ", "", "C"]) == ["A", "B", "C"]
    assert _normalize_keywords(None) == []
    assert _normalize_keywords(123) == []


def test_tokenize_text():
    assert _tokenize_text("  Hallo\n   Welt  ") == "hallo welt"
    assert _tokenize_text("") == ""


def test_count_keyword_hits_substring_in_kompositum():
    # Deutsche Komposita: Stichwort 'schiebetür' matcht in 'Schiebetür' und 'Hebeschiebetür'
    text = _tokenize_text("Hebeschiebetür defekt")
    hits, term = _count_keyword_hits("schiebetür", text)
    assert hits == 1 and term == "schiebetür"


def test_count_keyword_hits_mehrwort_phrase():
    text = _tokenize_text("Der Rahmen verzogen, schiebt nicht mehr leichtgängig")
    hits, term = _count_keyword_hits("rahmen verzogen", text)
    assert hits == 1 and term == "rahmen verzogen"
    hits2, _ = _count_keyword_hits("schiebt nicht", text)
    assert hits2 == 1


def test_count_keyword_hits_leeres_keyword():
    text = _tokenize_text("Egal welcher Text")
    hits, term = _count_keyword_hits("  ", text)
    assert hits == 0 and term is None


def test_count_keyword_hits_mehrere_treffer_zaehlen():
    text = _tokenize_text("Schiebetür defekt. Andere Schiebetür auch kaputt.")
    hits, _ = _count_keyword_hits("schiebetür", text)
    assert hits == 2
