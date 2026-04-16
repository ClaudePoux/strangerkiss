const fs = require('fs');
const path = 'C:/Users/Claude/scripts/supabase_migrate.sql';

function row(country, name, age, gender, nationality, bio, appearance, looking_for) {
  const esc = s => s.replace(/'/g, "''");
  return `('${country}','${esc(name)}',${age},'${gender}','${nationality}','${esc(bio)}','${esc(appearance)}','${looking_for}')`;
}

// FR: need 13 more hommes  (currently 32, need 45)
const fr_m = [
  row('fr','Éric',40,'homme','FR',"Commercial tech qui voulait voir autre chose","Veste sport, sac à dos, sourire détendu",'hug'),
  row('fr','Arnaud',35,'homme','FR',"Véto en congès scientifique","Blouse rangée, regard calme, adore les bêtes",'french_kiss'),
  row('fr','Xavier',29,'homme','FR',"Ingénieur son entre deux festivals","Casque audio, veste technique, air focalisé",'hug'),
  row('fr','Renaud',44,'homme','FR',"Cuisinier de cantine, premier vrai voyage solo","Tablier dans le sac, regard émerveillé",'hug'),
  row('fr','Serge',51,'homme','FR',"Retraité anticipé qui redécouvre le monde","Chapeau de paille, guide de voyage, pas pressé",'french_kiss'),
  row('fr','Yves',47,'homme','FR',"Infirmier en congrès, enfin un peu de temps","Blouse pliée, sac pratique, regard bienveillant",'hug'),
  row('fr','Thierry',39,'homme','FR',"Technicien lumière entre deux spectacles","Veste noire, badge de scène, air nocturne",'hug'),
  row('fr','Rémi',32,'homme','FR',"Biologiste en déplacement terrain","Sac étanche, carnet de terrain, bottes robustes",'french_kiss'),
  row('fr','Franck',37,'homme','FR',"Chef de projet IT en workation surprise","Laptop, hoodie, air légèrement perdu",'hug'),
  row('fr','Damien',26,'homme','FR',"Apprenti cuisinier en stage à l'étranger","Tablier blanc, couteaux en sacoche, curiosité culinaire",'hug'),
  row('fr','Bertrand',55,'homme','FR',"Notaire qui prend sa retraite progressivement","Look classique décontracté, montre de qualité",'french_kiss'),
  row('fr','Jean-Marc',48,'homme','FR',"Douanier en vacances, voit le monde autrement","Physique robuste, look discret, humour décalé",'hug'),
  row('fr','Luc',33,'homme','FR',"Géomètre arpenteur, partout mais jamais touriste","Appareil de mesure, carnet, air concentré",'hug'),
];

// IT: need 5 more femmes + 15 more hommes
const it_extra = [
  row('it','Aurora',32,'femme','IT',"Designer di moda in cerca d'ispirazione","Look curato, occhio critico, borse multiple",'hug'),
  row('it','Sveva',27,'femme','IT',"Biologa marina tra due campagne scientifiche","Maglione navy, binocolo, capelli al vento",'french_kiss'),
  row('it','Chiara',44,'femme','IT',"Nutrizionista che esplora mercati locali","Borsa di tela, lista della spesa, sorriso sano",'hug'),
  row('it','Noemi',23,'femme','IT',"Studentessa di design, primo viaggio in solitaria","Sketchbook, matite colorate, aria curiosa",'hug'),
  row('it','Vittoria',37,'femme','IT',"Avvocata ambientale in convegno europeo","Tablet, look professionale rilassato, sguardo determinato",'french_kiss'),
  row('it','Emilio',45,'homme','IT',"Cuoco di bordo sbarcato per qualche giorno","Mani robuste, sorriso aperto, pelle abbronzata",'hug'),
  row('it','Aldo',52,'homme','IT',"Pensionato dinamico in tour europeo","Cappello da viaggio, zaino leggero, passo sicuro",'hug'),
  row('it','Cesare',36,'homme','IT',"Architetto paesaggista tra due incarichi","Schizzo in mano, stivali da campo, sguardo curioso",'french_kiss'),
  row('it','Renato',47,'homme','IT',"Ingegnere navale in trasferta","Caschetto in borsa, scarpe robuste, aria tecnica",'hug'),
  row('it','Mario',58,'homme','IT',"Ferroviere pensionato che esplora in treno","Cappello logoro, zaino pratico, storia da raccontare",'hug'),
  row('it','Franco',41,'homme','IT',"Veterinario tra due congressi","Borsa professionale, calma, ama tutti gli animali",'french_kiss'),
  row('it','Giulio',30,'homme','IT',"Pompiere in riposo, solido e rassicurante","Fisico atletico, look semplice, sguardo tranquillo",'hug'),
  row('it','Virgilio',43,'homme','IT',"Direttore marketing in fuga dal consiglio","Vestito rilassato, telefono quasi spento, sorriso vero",'hug'),
  row('it','Guido',27,'homme','IT',"Assistente di volo in scalo improvvisato","Uniforme, trolley cabina, leggermente jet-lagged",'french_kiss'),
  row('it','Beppe',35,'homme','IT',"Cuoco di strada, sempre in movimento","Grembiule da campo, borsa di spezie, entusiasmo",'hug'),
  row('it','Ezio',49,'homme','IT',"Pilota di linea in scalo di 6 ore","Uniforme sbottonata, valigia pilota, stanchezza elegante",'hug'),
  row('it','Aldo',38,'homme','IT',"Regista teatrale tra una produzione e l'altra","Berretto, sceneggiatura in mano, sguardo visionario",'french_kiss'),
  row('it','Nereo',55,'homme','IT',"Ex pescatore che scopre le città","Stivali nautici, pelle abbronzata, mani forti",'hug'),
  row('it','Fausto',60,'homme','IT',"Vedovo che riscopre la vita a 60 anni","Giacca ordinata, sguardo timido ma caldo",'hug'),
  row('it','Orfeo',31,'homme','IT',"Musicista classico in tournée","Violino in spalla, cravatta allentata, sensibilità palese",'french_kiss'),
];

// DE: need 4 more femmes + 16 more hommes
const de_extra = [
  row('de','Ursula',43,'femme','DE',"Sozialarbeiterin gönnt sich endlich Urlaub","Bequeme Kleidung, warmes Lächeln, ruhige Präsenz",'hug'),
  row('de','Elfriede',57,'femme','DE',"Pensionierte Buchhalterin auf Entdeckungsreise","Korrekte Kleidung, Stadtplan, glücklich verloren",'hug'),
  row('de','Irmgard',48,'femme','DE',"Krankenhausärztin zwischen zwei Konferenzen","Notizblock, praktische Kleidung, besänftigender Blick",'french_kiss'),
  row('de','Walburga',35,'femme','DE',"Landschaftsgärtnerin, Natur immer im Blick","Feldstiefel, Skizzenheft, Lupe in der Tasche",'hug'),
  row('de','Friedrich',29,'homme','DE',"Reisejournalist zwischen zwei Recherchen","Khaki-Weste, immer ein Notizblock, neugieriger Schritt",'hug'),
  row('de','Ernst',44,'homme','DE',"Polizeibeamter im Urlaub, entspannt und freundlich","Zivile Kleidung, ruhige Ausstrahlung",'hug'),
  row('de','Gerhard',52,'homme','DE',"Pensionierter Lehrer auf Weltreise","Wanderhut, Reiseführer, unendliche Neugier",'french_kiss'),
  row('de','Hans',55,'homme','DE',"Rentner der die Freiheit genießt","Bequeme Hose, leichtes Hemd, freier Schritt",'hug'),
  row('de','Manfred',48,'homme','DE',"Buchhalter endlich im Abenteuer-Modus","Konservative Kleidung, lockerer Kragen, verstecktes Lächeln",'hug'),
  row('de','Norbert',60,'homme','DE',"Witwer der das Leben neu entdeckt","Gepflegte Jacke, schüchterner aber herzlicher Blick",'hug'),
  row('de','Wolfgang',41,'homme','DE',"Ingenieur auf Messe zwischen zwei Terminen","Namensschild, praktischer Anzug, freundlicher Blick",'french_kiss'),
  row('de','Dieter',37,'homme','DE',"Konditor auf internationalen Messen","Zarte Hände, Werkzeugkoffer, feines Näschen",'hug'),
  row('de','Erich',46,'homme','DE',"Sportangler auf Kulturausflug","Gummistiefel, gelassene Ausstrahlung, Gesprächsbereitschaft",'hug'),
  row('de','Rudolf',38,'homme','DE',"Tierarzt auf Wissenschaftskongress","Profirucksack, ruhige Art, liebt alle Tiere",'french_kiss'),
  row('de','Hartmut',32,'homme','DE',"Feuerwehrmann im Ruhestand, stark und beruhigend","Kräftiger Körperbau, einfache Jacke, gefasster Blick",'hug'),
  row('de','Heinz',43,'homme','DE',"Marketingleiter flüchtet aus dem Vorstand","Lockerer Anzug, Telefon fast aus, echtes Lächeln",'hug'),
  row('de','Karl',28,'homme','DE',"Linienflugbegleiter bei ungeplantem Stopover","Uniform, Kabinentrolley, leicht übermüdet aber nett",'french_kiss'),
  row('de','Georg',50,'homme','DE',"Alleinerziehender Vater entdeckt Freiheit wieder","Praktische Jacke, offenes Lächeln, ruhige Augen",'hug'),
  row('de','Dietrich',35,'homme','DE',"Straßenköche immer unterwegs","Feldschürze, Gewürztasche, kulinarische Begeisterung",'hug'),
  row('de','Ulrich',27,'homme','DE',"Marinemann für ein paar Tage an Land","Marinepulli, gebräunte Haut, starke Hände",'french_kiss'),
];

// ES: need 5 more femmes + 13 more hommes
const es_extra = [
  row('es','Soledad',37,'femme','ES',"Diseñadora textil buscando telas locales","Muestras de tela, ojo artístico, dedos creativos",'hug'),
  row('es','Paz',29,'femme','ES',"Enfermera de urgencias en vacaciones merecidas","Look deportivo, mochila, sonrisa desahogada",'hug'),
  row('es','Blanca',33,'femme','ES',"Sommelière en tour vinícola","Copa de cata, libreta elegante, olfato refinado",'french_kiss'),
  row('es','Virtudes',23,'femme','ES',"Estudiante de periodismo en prácticas","Cámara, libreta, curiosidad sin límites",'hug'),
  row('es','Luz',44,'femme','ES',"Farmacéutica en viaje botánico","Bolsa de campo, guantes de jardinero, aire sereno",'french_kiss'),
  row('es','Mateo',32,'homme','ES',"Ingeniero naval en traslado","Casco en bolsa, botas robustas, aire técnico",'hug'),
  row('es','Arturo',47,'homme','ES',"Jubilado activo que recorre Europa en tren","Sombrero, mochila ligera, paso seguro",'hug'),
  row('es','Sebastián',38,'homme','ES',"Veterinario en congreso científico","Mochila profesional, calma, ama todos los animales",'french_kiss'),
  row('es','Hugo',30,'homme','ES',"Bombero de guardia, tranquilo y reconfortante","Físico sólido, ropa sencilla, mirada serena",'hug'),
  row('es','Bernardo',43,'homme','ES',"Director marketing huyendo del consejo","Traje relajado, teléfono casi apagado, sonrisa real",'hug'),
  row('es','Aurelio',27,'homme','ES',"Auxiliar de vuelo en escala improvisada","Uniforme, trolley de cabina, ligeramente jet-lagged",'french_kiss'),
  row('es','Rufino',55,'homme','ES',"Ex marinero que descubre las ciudades","Botas náuticas, piel bronceada, manos fuertes",'hug'),
  row('es','Cándido',60,'homme','ES',"Viudo que redescubre la vida a los 60","Ropa limpia, mirada tímida pero cálida",'hug'),
  row('es','Félix',35,'homme','ES',"Músico de orquesta entre temporadas","Partitura en bolsa, postura erguida, sensibilidad evidente",'french_kiss'),
  row('es','Isidro',41,'homme','ES',"Pastelero en ferias internacionales","Manos delicadas, maletín de herramientas, nariz fina",'hug'),
  row('es','Rogelio',29,'homme','ES',"Fotógrafo de naturaleza en la ciudad","Teleobjetivo, ropa funcional, ojo entrenado",'hug'),
  row('es','Victoriano',52,'homme','ES',"Ingeniero jubilado que viaja en tren","Gorra de visera, mochila pequeña, paso tranquilo",'french_kiss'),
  row('es','Amancio',44,'homme','ES',"Médico rural en congreso nacional","Maletín médico, mirada tranquilizadora, paso seguro",'hug'),
];

// EN: need 5 more femmes + 12 more hommes
const en_extra = [
  row('en','Ethel',54,'femme','GB',"Retired GP finally travelling solo","Comfortable walking shoes, practical coat, warm smile",'hug'),
  row('en','Mabel',47,'femme','GB',"Head librarian on an unexpected adventure","Reading glasses, canvas bag full of books, wonder",'hug'),
  row('en','Hattie',33,'femme','GB',"Environmental engineer at a sustainability summit","Eco clothing, metal water bottle, green convictions",'french_kiss'),
  row('en','Clarice',26,'femme','GB',"Pastry chef at international culinary fairs","Delicate hands, tool case, discerning nose",'hug'),
  row('en','Muriel',39,'femme','GB',"Nutritionist touring farmers markets","Canvas tote, shopping list, healthy enthusiast",'french_kiss'),
  row('en','Reg',44,'homme','GB',"Civil servant finally on holiday mode","Sensible clothing, relieved expression, open smile",'hug'),
  row('en','Alistair',52,'homme','GB',"Retired banker discovering slow travel","Quality watch, relaxed look new to him",'hug'),
  row('en','Clem',38,'homme','GB',"Theatre director between productions","Beret, script in hand, visionary gaze",'french_kiss'),
  row('en','Ned',31,'homme','GB',"Marine biologist ashore for a few days","Wet suit bag, tanned skin, strong hands",'hug'),
  row('en','Barnaby',55,'homme','GB',"Retired fisherman discovering cities","Sea boots, weathered face, fond of chatting",'hug'),
  row('en','Albie',27,'homme','GB',"Sound engineer between music festivals","Monitor headphones, technical jacket, focused air",'french_kiss'),
  row('en','Piers',43,'homme','GB',"Consultant photographer scouting locations","Heavy camera, technical vest, sharp eye",'hug'),
  row('en','Sid',33,'homme','GB',"Landscape gardener far from his garden","Field boots, sketching notebook, magnifying glass",'hug'),
  row('en','Monty',48,'homme','GB',"Customs officer genuinely relaxing for once","Robust build, quiet humour, discreet look",'french_kiss'),
  row('en','Geoff',60,'homme','GB',"Widower rediscovering life at 60","Clean jacket, shy but heartfelt gaze",'hug'),
  row('en','Wilf',36,'homme','GB',"Structural engineer between site visits","Technical drawings in bag, hard-hat hair, curious",'hug'),
  row('en','Rudy',29,'homme','GB',"Nature photographer visiting an urban jungle","Telephoto lens, functional clothing, trained eye",'french_kiss'),
];

// EE: need 8 more hommes (to reach 45M: have 37, need +8)
const ee_m_extra = [
  row('ee','Władysław',50,'homme','PL',"Strażak na urlopie, spokojny i uspokajający","Atletyczna sylwetka, zwykła kurtka, spokojne spojrzenie",'hug'),
  row('ee','Zygmunt',43,'homme','PL',"Dyrektor marketingu uciekający z zarządu","Swobodny garnitur, telefon prawie wyłączony, prawdziwy uśmiech",'hug'),
  row('ee','Zbyszek',27,'homme','PL',"Steward lotniczy na nieplanowanym postoju","Mundur, walizka kabinowa, lekko jet-lagged",'french_kiss'),
  row('ee','Kazimierz',60,'homme','PL',"Wdowiec odkrywający życie po 60-tce","Czysta kurtka, nieśmiałe ale ciepłe spojrzenie",'hug'),
  row('ee','Vladimír',33,'homme','CZ',"Záchranář na dovolené, klidný a uklidňující","Atletická postava, jednoduchá bunda, vyrovnaný pohled",'hug'),
  row('ee','Zdeněk',47,'homme','CZ',"Pensionista prozkoumávající Evropu vlakem","Cestovní klobouk, lehký batoh, jistý krok",'hug'),
  row('ee','Miroslav',38,'homme','CZ',"Veterinář na vědecké konferenci","Profesionální batoh, klid, miluje všechna zvířata",'french_kiss'),
  row('ee','Vladimír',55,'homme','HU',"Nyugdíjas tanár felfedező úton","Kényelmes cipő, városterek, korlátlan kíváncsiság",'hug'),
];

const blocks = [
  `\n-- FR supplement (13 hommes)\ninsert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values\n${fr_m.join(',\n')};\n`,
  `\n-- IT supplement (5 femmes + 15 hommes)\ninsert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values\n${it_extra.join(',\n')};\n`,
  `\n-- DE supplement (4 femmes + 16 hommes)\ninsert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values\n${de_extra.join(',\n')};\n`,
  `\n-- ES supplement (5 femmes + 13 hommes)\ninsert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values\n${es_extra.join(',\n')};\n`,
  `\n-- EN supplement (5 femmes + 12 hommes)\ninsert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values\n${en_extra.join(',\n')};\n`,
  `\n-- EE supplement (8 hommes)\ninsert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values\n${ee_m_extra.join(',\n')};\n`,
];

fs.appendFileSync(path, blocks.join(''), 'utf8');

const total = fr_m.length + it_extra.length + de_extra.length + es_extra.length + en_extra.length + ee_m_extra.length;
console.log('Supplement profiles:', total);
console.log('Grand total: 509 +', total, '=', 509 + total);
