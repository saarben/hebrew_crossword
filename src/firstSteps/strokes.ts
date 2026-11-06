/**
 * Hand-authored stroke centre-lines for the 22 Hebrew letters (block style),
 * in a 100x100 box. Each letter is a list of strokes; each stroke is a list of
 * points in the order a child should draw it (first point = start dot).
 */
export type Pt = [number, number];
export interface LetterStrokes {
  strokes: Pt[][];
}

export const STROKES: Record<string, LetterStrokes> = {
  alef: { strokes: [[[36, 33], [68, 77]], [[69, 32], [54, 56]], [[46, 48], [35, 78]]] },
  bet: { strokes: [[[31, 35], [59, 35], [59, 73], [71, 73], [32, 73]]] },
  gimel: { strokes: [[[39, 34], [56, 34], [60, 75]], [[56, 57], [38, 76]]] },
  dalet: { strokes: [[[24, 22], [76, 22]], [[64, 22], [64, 80]]] },
  he: { strokes: [[[34, 35], [64, 35], [64, 74]], [[35, 63], [35, 75]]] },
  vav: { strokes: [[[42, 34], [52, 34], [52, 76]]] },
  zayin: { strokes: [[[34, 22], [66, 22]], [[50, 22], [50, 80]]] },
  het: { strokes: [[[34, 36], [66, 36], [65, 74]], [[34, 37], [34, 73]]] },
  tet: { strokes: [[[65, 32], [65, 74], [35, 73], [34, 34]], [[63, 31], [53, 43]]] },
  yod: { strokes: [[[38, 24], [58, 24], [58, 56]]] },
  kaf: { strokes: [[[32, 34], [61, 34], [61, 76], [32, 76]]] },
  lamed: { strokes: [[[37, 20], [35, 33], [63, 33], [62, 74], [33, 74]]] },
  mem: { strokes: [[[33, 76], [42, 36], [63, 36], [65, 73], [55, 74]], [[38, 49], [27, 37]]] },
  nun: { strokes: [[[55, 34], [55, 76], [32, 76]]] },
  samekh: { strokes: [[[31, 33], [65, 33], [65, 64], [57, 75], [42, 75], [35, 66], [35, 33]]] },
  ayin: { strokes: [[[64, 31], [63, 76], [31, 77]], [[39, 33], [44, 76]]] },
  pe: { strokes: [[[43, 56], [31, 56], [32, 34], [64, 34], [64, 78], [31, 78]]] },
  tsadi: { strokes: [[[34, 35], [67, 76], [31, 75]], [[65, 31], [49, 54]]] },
  qof: { strokes: [[[31, 35], [62, 35], [62, 72]], [[36, 56], [36, 93]]] },
  resh: { strokes: [[[24, 22], [62, 22], [72, 30], [72, 80]]] },
  shin: { strokes: [[[71, 31], [71, 76], [27, 76], [27, 32]], [[50, 31], [49, 76]]] },
  tav: { strokes: [[[22, 26], [28, 22], [68, 22], [76, 30], [76, 80]], [[34, 24], [34, 70], [30, 80], [22, 80]]] },
};
