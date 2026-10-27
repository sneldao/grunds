# Fact sheet — "Dear Newcomer: A Letter from Lisbon"

Everything the film asserts, where it comes from, and what an edit may not say.
The submission's accuracy score rests on this file: the claims below are the
only ones allowed on screen or in the entry description.

## 1. The locality pack is the source of the on-screen numbers

The film's concrete detail is what the live tool actually minted. Re-read it
(no key needed — the pack is cached server-side):

```
curl -s 'https://grunds.trustfall.xyz/city/pack?city=Lisbon'
```

Live response, re-fetched 2026-10-26:

| field | value |
|---|---|
| display | Lisbon, Portugal |
| district | Príncipe Real |
| currency | € |
| price | 4 (matcha latte, in € ) |
| landmark | black-and-white calçada portuguesa paving |
| palette | whitewash, azulejo blue, terracotta, ochre |
| barista (rival) | João |
| names | João, Maria, Ana, Miguel, Sofia, Inês, Rui, Teresa |
| cafés | Nicolau Lisboa, Hello, Kristof, Seagull Method, Fabrica Coffee Roasters, Dear Breakfast |
| line | Lisbon welcomes your new coffee stand with warm light and curious regulars. |

`cached: true`, `fallback: false` — this is the pack the film was shot against,
not the generic fallback. Keep `videos/city-remix/direction/` as the record.

## 2. Claim-by-claim

| # | Claim as it appears in the film | Verdict | Evidence |
|---|---|---|---|
| 1 | "Príncipe Real" is a Lisbon district (ticker sub-label) | **Verified** | Príncipe Real is a real Lisbon *freguesia*/neighbourhood, in the Bairro Alto / São Bento area of the city centre. Calçada art is documented there (Alamy caption: "neighborhoods, including Bairro Alto, Príncipe Real"). |
| 2 | Black-and-white calçada portuguesa paving is a Lisbon landmark | **Verified** | [Wikipedia — Portuguese pavement](https://en.wikipedia.org/wiki/Portuguese_pavement): "small pieces of stone arranged in a pattern or image, like a mosaic"; white limestone + black basalt, and it is one of Lisbon's best-known details. |
| 3 | Palette: whitewash, azulejo blue, terracotta, ochre | **Verified, as description** | Azulejo tilework and whitewash façades are Lisbon's documented vernacular. Phrase it as the *look of the street*, never as a claim about a specific address. |
| 4 | "A matcha here runs about €4" | **Verified as an approximation** | Lisbon café menus land at roughly €3–5 for a matcha latte ([Yelp Lisbon matcha listings](https://www.yelp.com/search?find_desc=Matcha+Latte&find_loc=Lisbon): "think anywhere from 3 euros to 5"; a Porto menu lists matcha latte €4.50). The word **"about"** is load-bearing — never print "€4" as a fixed price. |
| 5 | The rival barista is called João | **Verified, as game fact** | It is the name the pack minted for this city (`barista: "João"`). It is a person *in the game*, not a real Lisbon barista — do not describe him as one. |
| 6 | Patron names Maria, Ana, Miguel, Sofia, Inês, Rui, Teresa | **Verified, as game fact** | The pack's `names` list; common Portuguese given names. Same caveat as #5. |
| 7 | Five independent cafés are listed near the pitch | **Verified that they exist; NOT verified as "near" or "in Príncipe Real"** | All five are real, independent Lisbon coffee places: **Nicolau Lisboa** (Rua de São Nicolau 17, Baixa; [Tripadvisor](https://www.tripadvisor.com/Restaurant_Review-g189158-d10920507-Reviews-Nicolau_Cafe-Lisbon_Lisbon_District_Central_Portugal.html)), **Hello, Kristof** (R. do Poço dos Negros 103, São Bento; [hellokristof.com](https://hellokristof.com/)), **Seagull Method** (near Cais do Sodré; [Instagram](https://www.instagram.com/seagullmethodcafe/)), **Dear Breakfast** (Bica / Chiado / Alfama; [dearbreakfast.com](https://www.dearbreakfast.com/)), **Fábrica Coffee Roasters** (Lisbon). They are spread across central Lisbon, **not** clustered in Príncipe Real. |
| 8 | "Lisbon welcomes your new coffee stand with warm light and curious regulars." | **Verified, as a generated line** | The pack's `line` field. It is the tool's welcome text, not a quotation from anybody. Quote it as the tool's line if the description uses it. |

## 3. What the edit must never say

- **Do not put the café names on screen.** Only three of the five are shown on
  the licence at all, and naming them in Príncipe Real would be false. The
  existing cut already keeps them out of the subtitle track — keep it that way.
- **No claim of partnership.** The cafés have not endorsed Grunds, and the
  street is not any of their addresses.
- **No claim that the game maps real Lisbon geography.** The street is a
  generated stage that borrows the city's names, palette and price currency.
- **No fixed price.** "About €4", never "€4".
- **No real barista.** João and the patron names are game characters.

## 4. Known weak spots (accepted, disclosed)

- The pack's district line ("Príncipe Real") and its café list do not describe
  the same part of town. The film shows the district as a name the street
  carries and lists no cafés, so the two never collide on screen; this is the
  honest reading and the one the entry description should state.
- The €4 price is the tool's figure, rounded from a real €3–5 band. The entry
  description should say "the price the tool minted, in the real local band"
  rather than presenting it as a surveyed price.

## 5. Sources to cite on the entry page

1. Portuguese pavement (calçada portuguesa) — https://en.wikipedia.org/wiki/Portuguese_pavement
2. Príncipe Real, Lisbon — neighbourhood of the city centre (Bairro Alto / São Bento area)
3. Hello, Kristof — https://hellokristof.com/
4. Dear Breakfast — https://www.dearbreakfast.com/
5. Seagull Method — https://www.instagram.com/seagullmethodcafe/
6. Nicolau Lisboa — https://www.tripadvisor.com/Restaurant_Review-g189158-d10920507-Reviews-Nicolau_Cafe-Lisbon_Lisbon_District_Central_Portugal.html
7. Lisbon matcha price band — https://www.yelp.com/search?find_desc=Matcha+Latte&find_loc=Lisbon
