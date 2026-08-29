import assert from "node:assert/strict";
import {
  browseTileSearchQuery,
  exploreCategoryLabel,
  foldExploreQuery,
  liveMatchesExploreQuery,
  pickExploreResultTab,
  resolveExploreCategoryKeys,
} from "./explore-search.ts";

function run() {
  assert.equal(foldExploreQuery("  Beauté "), "beaute");
  assert.deepEqual(resolveExploreCategoryKeys("fashion"), ["Fashion"]);
  assert.deepEqual(resolveExploreCategoryKeys("Mode"), ["Fashion"]);
  assert.deepEqual(resolveExploreCategoryKeys("mode femme"), ["Fashion"]);
  assert.deepEqual(resolveExploreCategoryKeys("Beauté"), ["Beauty"]);
  assert.deepEqual(resolveExploreCategoryKeys("beauty"), ["Beauty"]);
  assert.deepEqual(resolveExploreCategoryKeys("parfums"), ["Perfumes"]);
  assert.equal(resolveExploreCategoryKeys("deena"), null);

  assert.equal(browseTileSearchQuery("beaute"), "Beauty");
  assert.equal(browseTileSearchQuery("mode-femme"), "Fashion");
  assert.equal(browseTileSearchQuery("sacs"), "Bags");
  assert.equal(browseTileSearchQuery("parfums"), "Perfumes");
  assert.equal(browseTileSearchQuery("maison"), "Home");

  assert.equal(exploreCategoryLabel("Fashion"), "Mode");
  assert.equal(exploreCategoryLabel("Beauty"), "Beauté");

  const fashionLive = {
    seller: "Awa",
    title: "Soldes robes",
    category: "Fashion" as const,
    handle: "awa",
  };
  const beautyLive = {
    seller: "Lina",
    title: "Glow",
    category: "Beauty" as const,
    handle: "lina",
  };
  assert.equal(liveMatchesExploreQuery(fashionLive, "fashion"), true);
  assert.equal(liveMatchesExploreQuery(fashionLive, "Mode"), true);
  assert.equal(liveMatchesExploreQuery(fashionLive, "mode femme"), true);
  assert.equal(liveMatchesExploreQuery(fashionLive, "Beauté"), false);
  assert.equal(liveMatchesExploreQuery(beautyLive, "beauté"), true);
  assert.equal(liveMatchesExploreQuery(fashionLive, "awa"), true);
  assert.equal(liveMatchesExploreQuery(fashionLive, "robes"), true);

  assert.equal(pickExploreResultTab({ query: "Mode", liveCount: 2, sellerCount: 1, productCount: 0 }), 0);
  assert.equal(pickExploreResultTab({ query: "Deena", liveCount: 0, sellerCount: 1, productCount: 0 }), 1);
  assert.equal(pickExploreResultTab({ query: "Deena Boutique", liveCount: 0, sellerCount: 1, productCount: 3 }), 1);
  assert.equal(pickExploreResultTab({ query: "jordan 4", liveCount: 0, sellerCount: 0, productCount: 4 }), 2);
}

run();
console.log("explore-search.test.ts ok");
