import unittest
from ops.ingestion.records import parse_record, merge_records


def record(title='Alice vs Bob ⎪ DLTLLY Birthday 2027', **kw):
    return dict(id='5Dh1E_ojpus', title=title, published_at='2027-01-02T13:00:00Z',
                channel_id='channel', channel_title='DLTLLY ⎪ battlerap culture',
                duration_seconds=600, views=42, **kw)


class RecordsTests(unittest.TestCase):
    def test_real_title_without_separator_never_consumes_channel(self):
        row = parse_record(record('🥶 SSYNIC vs BEASTBOY #dltlly'))
        self.assertEqual(row['Name #2'], 'BEASTBOY')
        self.assertEqual(row['Event'], 'could not identify event')
        self.assertEqual(row['Channel'], 'DLTLLY')
        self.assertEqual(list(row)[:10], ['Name #1', 'Name #2', 'Event', 'Type', 'Year', 'Channel', 'Uploaded', 'URL', 'ID', 'Views'])

    def test_real_entities_and_onbeat(self):
        row = parse_record(record('Jeystone vs N&#39;antinein | OnBeat Battle | Berlin (Panke) | 30.03.2024 | D&amp;DL OnBeat Premiere'))
        self.assertEqual(row['Name #2'], "N'antinein")
        self.assertEqual(row['Type'], 'On Beat')
        self.assertEqual(row['Year'], 2024)
        self.assertEqual(row['Content category'], 'battle')

    def test_supporting_content_is_retained_separately(self):
        for title, category in [
            ('PA SPORTS vs SSYNIC ⎪ Das Interview zum Battle @ BDay 13 ⎪ DLTLLY', 'interview'),
            ('Ssynic vs PA Sports // Out Now #dltlly', 'promo'),
            ('Alice vs Bob | Pressekonferenz', 'promo'),
            ('Alice vs Bob | Quiz', 'other'),
            ('Alice vs Bob | Rap Battle + Interview | Co-Event', 'battle'),
        ]:
            with self.subTest(title=title):
                self.assertEqual(parse_record(record(title))['Content category'], category)

    def test_real_single_slash_event_does_not_pollute_artist_name(self):
        row = parse_record(record('Mighty P vs Papi Schlauch / Viertelfinale - Freestyle Turnier / ProvingGrounds 2 Rapbattles / DLTLLY'))
        self.assertEqual(row['Name #2'], 'Papi Schlauch')
        self.assertEqual(row['Event'], 'Viertelfinale - Freestyle Turnier')

    def test_real_105_second_clip_is_retained_outside_battles(self):
        item = record('🥶 SSYNIC vs BEASTBOY #dltlly')
        item['duration_seconds'] = 105
        row = parse_record(item)
        self.assertEqual(row['Content category'], 'other')
        self.assertEqual(row['Name #2'], 'BEASTBOY')

    def test_future_year_and_canonical_date(self):
        row = parse_record(record())
        self.assertEqual(row['Year'], 2027)
        self.assertEqual(row['Uploaded'], '2027-01-02')
        value = record('Alice vs Bob')
        value['published_at'] = '2028-01-01T00:30:00+02:00'
        self.assertEqual(parse_record(value)['Uploaded'], '2027-12-31')

    def test_legacy_ram_markers_are_events_not_artist_names(self):
        fixtures = [
            ('AGGRO.TV RAP AM MITTWOCH - GIER VS P-ZAK - KING FINALE VOM 19.12.2012 (OFFICIAL HD VERSION AGGRO TV)', 'GIER', 'P-ZAK'),
            ('RAP AM MITTWOCH: TightamMic vs Drob Dynamic 19.06.13 BattleMania King Finale (5/5) GERMAN BATTLE', 'TightamMic', 'Drob Dynamic'),
            ('BMCL RAP BATTLE: MIGHTY MO VS CASHISCLAY (OPENAIR FRAUENFELD)', 'MIGHTY MO', 'CASHISCLAY'),
            ('RAP AM MITTWOCH KING FINALE VOM 04.05.2011 GIER VS. PIRATE (OFFICIAL HD VERSION AGGRO TV)', 'GIER', 'PIRATE'),
            ('Sport-Rap-Battle #1: Borussia Dortmund vs. FC Bayern München | DLTLLY | Rap Battles | SPOX', 'Borussia Dortmund', 'FC Bayern München'),
            ('DLTLLY+D&DL "Breakthrough" Steel vs Tollschock // Finale (DISSember4 // Stuttgart) // 2019', 'Steel', 'Tollschock'),
        ]
        for title, first, second in fixtures:
            with self.subTest(title=title):
                row = parse_record(record(title))
                self.assertEqual(row['Name #1'], first)
                self.assertEqual(row['Name #2'], second)

    def test_tournament_and_interview_annotations_do_not_pollute_names(self):
        fixtures = [
            ("Freestyle Turnier 1/7: Joseph Steinschleuder vs N'Antinein | Vorrunde @ BDAY 11 | DLTLLY", 'Joseph Steinschleuder', "N'Antinein"),
            ('BMCL MEETS DLTLLY RAP BATTLE: BESSER vs PROTON', 'BESSER', 'PROTON'),
            ('Tobi High vs Wolff - Interview', 'Tobi High', 'Wolff'),
            ('Mars B. vs Hiding John Interview mit Moitz', 'Mars B.', 'Hiding John'),
            ('Craze vs Kato - Das Interview mit ANA', 'Craze', 'Kato'),
            ('NOTYZZE vs PATO G (FINALE) | FOB', 'NOTYZZE', 'PATO G'),
            ('LITTLE SEDO vs MALIK (NEWCOMER BATTLE) | FOB', 'LITTLE SEDO', 'MALIK'),
            ('Ankündigung: MIKESH vs SSYNIC // MAYhem 5', 'MIKESH', 'SSYNIC'),
        ]
        for title, first, second in fixtures:
            with self.subTest(title=title):
                row = parse_record(record(title))
                self.assertEqual(row['Name #1'], first)
                self.assertEqual(row['Name #2'], second)

    def test_ambiguous_multi_battle_promos_are_not_artist_names(self):
        self.assertIsNone(parse_record(record('🏆 PPV OUT NOW - MIT TITLE MATCH STEEL VS. MORGANA, VYRUS, YUAH, REQUIEM UVM. | FOB')))
        self.assertIsNone(parse_record(record('01.06.24 #BIELEFELD 🎬 PPV Out Now! 🔥 Full Trailer 🔥 Neilz vs Davie Jones + 5 weitere Battles im PPV!')))

    def test_dudl_episode_marker_ends_artist_name(self):
        row = parse_record(record('Mave vs Hörsturz D&DL#0058 (Halle // 2017)'))
        self.assertEqual(row['Name #2'], 'Hörsturz')
        self.assertIn('Halle', row['Event'])
        self.assertEqual(row['Year'], 2017)

    def test_numbered_event_hashtags_survive(self):
        for event in ['MAYhem #7', 'B.Day#3', 'Splash #17']:
            self.assertEqual(parse_record(record('Alice vs Bob | ' + event))['Event'], event)

    def test_legacy_unknown_views_normalized_even_without_fresh_record(self):
        for value in ['nan', float('nan'), '', None, 'N/A']:
            old = dict(parse_record(record()), Views=value)
            self.assertEqual(merge_records([old], [])[0]['Views'], 'Unknown')

    def test_missing_channel_and_views_are_unknown(self):
        item = record()
        item['channel_title'] = None
        item['views'] = None
        row = parse_record(item)
        self.assertEqual(row['Channel'], 'Unknown')
        self.assertEqual(row['Views'], 'Unknown')

    def test_invalid_identity_duration_and_uncertain_names(self):
        for key, value in [('id', 'bad'), ('duration_seconds', 98), ('duration_seconds', None), ('title', 'Unrelated video'), ('title', 'Alice vs '), ('title', 'Alice vs Bob vs Carol')]:
            item = record(); item[key] = value
            self.assertIsNone(parse_record(item))

    def test_distinct_ids_survive_identical_metadata(self):
        a = parse_record(record()); b = dict(a, ID='MkO4Kivu-oc', URL='https://www.youtube.com/watch?v=MkO4Kivu-oc')
        self.assertEqual(len(merge_records([a], [b])), 2)

    def test_unknown_new_values_do_not_destroy_old_metadata(self):
        old = parse_record(record())
        new = dict(old, Event='could not identify event', Uploaded='Unknown', Year='Unknown', Views=None, Channel='N/A')
        self.assertEqual(merge_records([old], [new]), [old])

    def test_unparseable_refresh_preserves_existing_and_updates_known_views(self):
        old = parse_record(record())
        new = record('No longer parseable'); new['views'] = 99
        result = merge_records([old], [new])
        self.assertEqual(result[0]['Name #1'], 'Alice')
        self.assertEqual(result[0]['Views'], 99)
        short = record(); short['duration_seconds'] = 12
        self.assertEqual(len(merge_records([old], [short])), 1)

    def test_merge_does_not_mutate_inputs_and_rejects_bad_ids(self):
        old = parse_record(record()); incoming = dict(old, Views=0)
        self.assertEqual(merge_records([old], [incoming])[0]['Views'], 0)
        self.assertEqual(old['Views'], 42)
        with self.assertRaises(ValueError):
            merge_records([dict(old, ID='bad')], [])

if __name__ == '__main__':
    unittest.main()
