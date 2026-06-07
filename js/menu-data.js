// Catálogo de la carta — fuente única de verdad
// Si cambias precios o platos en la carta digital, replícalos aquí
// (en una iteración futura los moveríamos a Firestore para editarlos desde el admin)

export const MENU = [
  // ─── SUSHI ───
  { id: "01", cat: "sushi", name: "Nigiri del abuelo Antonio",          pieces: "2 piezas",  price: 5.70,  desc: "Atún rojo, panko y aire del jugo del «picaíllo».",        photo: "fotos-carta/01.jpg" },
  { id: "02", cat: "sushi", name: "Nigiri flameado de ventresca y foie", pieces: "2 piezas", price: 6.00,  desc: "Con ralladura de corazón de atún curado.",                 photo: "fotos-carta/02.jpg" },
  { id: "03", cat: "sushi", name: "Nigiri de anguila",                  pieces: "2 piezas",  price: 6.00,  desc: "Con foie flameado.",                                       photo: "fotos-carta/03.jpg" },
  { id: "04", cat: "sushi", name: "Nigiri de salmón y ajo negro",       pieces: "2 piezas",  price: 5.70,  desc: "Mahonesa de ajo negro y alcaparra.",                       photo: "fotos-carta/04.jpg" },
  { id: "05", cat: "sushi", name: "Nigiri de salmón al teriyaki",       pieces: "2 piezas",  price: 5.50,  desc: "Pez mantequilla con salsa de trufa negra.",                photo: "fotos-carta/05.jpg" },
  { id: "06", cat: "sushi", name: "Nigiri de dorada",                   pieces: "2 piezas",  price: 5.50,  desc: "Con mantequilla dulce picante.",                           photo: "fotos-carta/06.jpg" },
  { id: "07", cat: "sushi", name: "Nigiri de butterfish",               pieces: "2 piezas",  price: 5.70,  desc: "Con mahonesa de trufa negra.",                             photo: "fotos-carta/07.jpg" },
  { id: "08", cat: "sushi", name: "Nigiri de boletus",                  pieces: "2 piezas",  price: 5.20,  desc: "Con papada ibérica y chip de ajo.",                        photo: "fotos-carta/08.jpg" },
  { id: "09", cat: "sushi", name: "Nigiri de jamón de pato",            pieces: "2 piezas",  price: 6.00,  desc: "Con reducción de mango y cebolla.",                        photo: "fotos-carta/09.jpg" },
  { id: "10", cat: "sushi", name: "Uramaki de salmón y aguacate",       pieces: "8 piezas",  price: 12.00, desc: "Con salsa unagi y cebolla frita.",                         photo: "fotos-carta/10.jpg" },
  { id: "11", cat: "sushi", name: "Uramaki de atún picante",            pieces: "8 piezas",  price: 13.00, desc: "Con aguacate y salsa picante.",                            photo: "fotos-carta/11.jpg" },
  { id: "12", cat: "sushi", name: "Uramaki de atún y kimchi",           pieces: "8 piezas",  price: 13.50, desc: "Con topping de salmón, mayo kimchi, lima y cebollino.",    photo: "fotos-carta/12.jpg" },
  { id: "13", cat: "sushi", name: "Uramaki de la casita",               pieces: "8 piezas",  price: 12.00, desc: "Membrillo, foie y panko crunch.",                          photo: "fotos-carta/13.jpg" },
  { id: "14", cat: "sushi", name: "Futomaki rainbow",                   pieces: "12 piezas", price: 15.00, desc: "Atún rojo, pez mantequilla, salmón y aguacate.",           photo: "fotos-carta/14.jpg" },

  // ─── ENTRANTES ───
  { id: "15", cat: "entrantes", name: "Tartar de atún rojo con ajoblanco", pieces: null,         price: 20.00, desc: "Con crujiente de miel de caña y aire de ponzu.",                              photo: "fotos-carta/15.jpg" },
  { id: "16", cat: "entrantes", name: "Ensaladilla de gambón",             pieces: null,         price: 14.00, desc: "Gambón, panko y mahonesa japonesa.",                                          photo: "fotos-carta/16.jpg" },
  { id: "17", cat: "entrantes", name: "Croquetas de kimchi",               pieces: "6 unidades", price: 12.00, desc: "Con leche de oveja y sashimi de atún rojo.",                                  photo: "fotos-carta/17.jpg" },
  { id: "18", cat: "entrantes", name: "Nuestra versión del takoyaki",      pieces: "6 unidades", price: 12.00, desc: "Con leche de oveja, pulpo, salsa unagi, katsuobushi y caldo dashi.",          photo: "fotos-carta/18.jpg" },
  { id: "19", cat: "entrantes", name: "Dumplings fritos",                  pieces: "6 unidades", price: 12.00, desc: "Relleno de alita de pollo a baja temperatura.",                               photo: "fotos-carta/19.jpg" },
  { id: "20", cat: "entrantes", name: "Gyozas de carrillera",              pieces: "2 unidades", price: 12.00, desc: "Relleno del guiso tradicional cordobés.",                                     photo: "fotos-carta/20.jpg" },
  { id: "21", cat: "entrantes", name: "Pan bao de panceta ibérica",        pieces: "2 unidades", price: 13.00, desc: "Cocinada a baja temperatura durante 9 horas.",                                photo: "fotos-carta/21.jpg" },
  { id: "22", cat: "entrantes", name: "Baozi de calamares",                pieces: "2 unidades", price: 15.00, desc: "Relleno de calamares «encebollaos».",                                         photo: "fotos-carta/22.jpg" },
  { id: "23", cat: "entrantes", name: "Baozi de bolognese",                pieces: "2 unidades", price: 14.00, desc: "Relleno de ragú de ternera y cerdo.",                                         photo: "fotos-carta/23.jpg" },

  // ─── PRINCIPALES ───
  { id: "24", cat: "principales", name: "Katsu curry",                       pieces: null, price: 16.00, desc: "Con arroz y lomo ibérico.",                                          photo: "fotos-carta/24.jpg" },
  { id: "25", cat: "principales", name: "Udon de carbonara",                 pieces: null, price: 19.00, desc: "Con guanchale y pecorino romano.",                                   photo: "fotos-carta/25.jpg" },
  { id: "26", cat: "principales", name: "Magret de pato de Navarra",         pieces: null, price: 21.00, desc: "Salsa de trufa y foie, setas de temporada y zanahorias baby.",      photo: "fotos-carta/26.jpg" },
  { id: "27", cat: "principales", name: "Tteokbokki en salsa de gochujang",  pieces: null, price: 18.00, desc: "Con mollejas de cordero y setas shitake.",                          photo: "fotos-carta/27.jpg" },
];

export const CATEGORIES = [
  { key: "sushi",       kanji: "寿司", label: "Sushi" },
  { key: "entrantes",   kanji: "前菜", label: "Entrantes" },
  { key: "principales", kanji: "主菜", label: "Principales" },
];

export const MENU_BY_ID = Object.fromEntries(MENU.map((d) => [d.id, d]));

export const formatEUR = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
