import unittest
from declarations import declarations

class DeclarationTests(unittest.TestCase):
    def test_reference_array_and_optional_parameter(self):
        record=declarations('int Resize(void& array[], int count, int reserve=0);','Resize')[0]
        self.assertEqual(record['parameters'][0]['type'],'void&')
        self.assertEqual(record['parameters'][0]['label'],'void& array[]')
        self.assertTrue(record['parameters'][2]['optional'])
    def test_help_trailing_comma(self):
        record=declarations('int Count(\n int handle,\n );','Count')[0]
        self.assertEqual(len(record['parameters']),1)
    def test_schematic_varargs(self):
        record=declarations('string Format(\n string format,\n ...\n ...\n );','Format')[0]
        self.assertEqual(len(record['parameters']),2)
        self.assertTrue(record['parameters'][1]['variadic'])
    def test_string_slashes_are_not_comments(self):
        record=declarations('void Set(string value="//");','Set')[0]
        self.assertEqual(record['parameters'][0]['label'],'string value="//"')
    def test_member_and_zero_arguments(self):
        record=declarations('ulong matrix::Rows(void) const;','Rows')[0]
        self.assertEqual(record['qualifiedName'],'matrix::Rows')
        self.assertEqual(record['parameters'],[])
        self.assertTrue(record['label'].endswith('const'))

if __name__=='__main__':unittest.main()
