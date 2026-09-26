import json
import unittest
from app.ai_client import extract_clean_json_str, extract_content_from_response, AIUnavailableError
from app.data_classifier import classify_and_normalize

class TestAIClientResilience(unittest.TestCase):
    def test_markdown_fence_cleaning(self):
        s = "```json\n{\"entities\": [{\"id\": \"e1\", \"name\": \"Vikram\"}]}\n```"
        clean = extract_clean_json_str(s)
        data = json.loads(clean)
        self.assertEqual(data["entities"][0]["name"], "Vikram")

    def test_deepseek_think_tags(self):
        s = "<think>Analyzing context...</think>\n{\"entities\": [{\"id\": \"e1\", \"name\": \"Ghost\"}]}"
        clean = extract_clean_json_str(s)
        self.assertNotIn("think", clean)
        data = json.loads(clean)
        self.assertEqual(data["entities"][0]["name"], "Ghost")

    def test_smart_quotes_and_trailing_commas(self):
        s = '{\u201centities\u201d: [{\u201cid\u201d: \u201ce1\u201d, \u201cname\u201d: \u201cTarget\u201d,},],}'
        clean = extract_clean_json_str(s)
        data = json.loads(clean)
        self.assertEqual(data["entities"][0]["name"], "Target")

    def test_openai_shape(self):
        resp = {"choices": [{"message": {"content": '{"entities": []}'}}]}
        self.assertEqual(extract_content_from_response(resp), '{"entities": []}')

    def test_gemini_shape(self):
        resp = {"candidates": [{"content": {"parts": [{"text": '{"entities": []}'}]}}]}
        self.assertEqual(extract_content_from_response(resp), '{"entities": []}')

    def test_legacy_text_shape(self):
        resp = {"choices": [{"text": '{"entities": []}'}]}
        self.assertEqual(extract_content_from_response(resp), '{"entities": []}')

    def test_top_level_text_shape(self):
        resp = {"response": '{"entities": []}'}
        self.assertEqual(extract_content_from_response(resp), '{"entities": []}')

    def test_error_shape(self):
        resp = {"error": {"message": "Model not available"}}
        with self.assertRaises(AIUnavailableError):
            extract_content_from_response(resp)

    def test_xml_classification(self):
        xml_text = "<report><target name='Sanjay Patel' role='Narcotics Lead'/></report>"
        res = classify_and_normalize(xml_text)
        self.assertEqual(res.bucket, "semi_structured")
        self.assertEqual(res.effective_type, "text")
        self.assertIn("Sanjay Patel", res.content)

if __name__ == "__main__":
    unittest.main()
