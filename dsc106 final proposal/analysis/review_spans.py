"""First and last review date per business (a proxy for when it was operating).

Usage: python3 review_spans.py <yelp_academic_dataset_review.json> <out_csv>
Streams the ~5 GB review file line by line; takes a few minutes.
"""
import sys, json

first, last, count = {}, {}, {}
with open(sys.argv[1]) as f:
    for line in f:
        r = json.loads(line)
        b, d = r["business_id"], r["date"][:10]
        if b not in first or d < first[b]:
            first[b] = d
        if b not in last or d > last[b]:
            last[b] = d
        count[b] = count.get(b, 0) + 1

with open(sys.argv[2], "w") as o:
    o.write("business_id,first_review,last_review,n_reviews\n")
    for b in first:
        o.write(f"{b},{first[b]},{last[b]},{count[b]}\n")
print("wrote", len(first), "businesses")
