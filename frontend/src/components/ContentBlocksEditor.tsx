"use client";
import type { PageSection } from "@/types";
type Faq = { question: string; answer: string };
export default function ContentBlocksEditor({
  sections,
  faqs,
  onSections,
  onFaqs,
}: {
  sections: PageSection[];
  faqs: Faq[];
  onSections: (v: PageSection[]) => void;
  onFaqs: (v: Faq[]) => void;
}) {
  function section(i: number, key: keyof PageSection, value: string) {
    onSections(sections.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
  }
  function items(i: number, value: { heading: string; body: string }[]) {
    onSections(sections.map((s, j) => (i === j ? { ...s, items: value } : s)));
  }
  return (
    <>
      <details>
        <summary>
          Page sections <span>+</span>
        </summary>
        <div>
          <p className="help">
            Homepage slots: about, services, why, process, technologies,
            projects, testimonials, blog, faq, cta. Other pages render sections
            in this order. Use a unique lowercase key. Upload images in Media
            and paste their URLs here.
          </p>
          {sections.map((s, i) => (
            <fieldset className="content-block-editor" key={i}>
              <legend>Section {i + 1}</legend>
              <label>
                Section key
                <input
                  value={s.key}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  onChange={(e) => section(i, "key", e.target.value)}
                />
              </label>
              <label>
                Section heading
                <input
                  value={s.heading}
                  maxLength={200}
                  required
                  onChange={(e) => section(i, "heading", e.target.value)}
                />
              </label>
              <label>
                Section description
                <textarea
                  value={s.body}
                  maxLength={3000}
                  rows={3}
                  onChange={(e) => section(i, "body", e.target.value)}
                />
              </label>
              <div className="form-two">
                <label>
                  Section link label
                  <input
                    value={s.linkLabel || ""}
                    maxLength={100}
                    onChange={(e) => section(i, "linkLabel", e.target.value)}
                  />
                </label>
                <label>
                  Section link path
                  <input
                    value={s.linkUrl || ""}
                    placeholder="/contact"
                    onChange={(e) => section(i, "linkUrl", e.target.value)}
                  />
                </label>
              </div>
              <div className="form-two">
                <label>
                  Section image URL
                  <input
                    value={s.image || ""}
                    onChange={(e) => section(i, "image", e.target.value)}
                  />
                </label>
                <label>
                  Section image alt text
                  <input
                    value={s.imageAlt || ""}
                    required={!!s.image}
                    maxLength={200}
                    onChange={(e) => section(i, "imageAlt", e.target.value)}
                  />
                </label>
              </div>
              <details>
                <summary>
                  Section items (reasons, process steps or technologies)
                </summary>
                <div>
                  {(s.items || []).map((item, j) => (
                    <fieldset className="content-block-editor" key={j}>
                      <legend>Item {j + 1}</legend>
                      <label>
                        Item heading
                        <input
                          value={item.heading}
                          maxLength={200}
                          required
                          onChange={(e) =>
                            items(
                              i,
                              (s.items || []).map((v, k) =>
                                j === k ? { ...v, heading: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Item description
                        <textarea
                          value={item.body}
                          maxLength={1000}
                          onChange={(e) =>
                            items(
                              i,
                              (s.items || []).map((v, k) =>
                                j === k ? { ...v, body: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          items(
                            i,
                            (s.items || []).filter((_, k) => j !== k),
                          )
                        }
                      >
                        Remove item
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    disabled={(s.items || []).length >= 20}
                    onClick={() =>
                      items(i, [
                        ...(s.items || []),
                        { heading: "New item", body: "" },
                      ])
                    }
                  >
                    Add item +
                  </button>
                </div>
              </details>
              <button
                type="button"
                onClick={() => onSections(sections.filter((_, j) => j !== i))}
              >
                Remove section
              </button>{" "}
              <button
                type="button"
                disabled={i === 0}
                onClick={() => {
                  const next = [...sections];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onSections(next);
                }}
              >
                Move up
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={sections.length >= 20}
            onClick={() =>
              onSections([
                ...sections,
                {
                  key: "section-" + (sections.length + 1),
                  heading: "New section",
                  body: "",
                },
              ])
            }
          >
            Add section +
          </button>
        </div>
      </details>
      <details>
        <summary>
          Frequently asked questions <span>+</span>
        </summary>
        <div>
          {faqs.map((f, i) => (
            <fieldset className="content-block-editor" key={i}>
              <legend>Question {i + 1}</legend>
              <label>
                Question
                <input
                  required
                  minLength={3}
                  maxLength={300}
                  value={f.question}
                  onChange={(e) =>
                    onFaqs(
                      faqs.map((v, j) =>
                        i === j ? { ...v, question: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Answer
                <textarea
                  required
                  minLength={3}
                  maxLength={3000}
                  rows={3}
                  value={f.answer}
                  onChange={(e) =>
                    onFaqs(
                      faqs.map((v, j) =>
                        i === j ? { ...v, answer: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => onFaqs(faqs.filter((_, j) => i !== j))}
              >
                Remove question
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={faqs.length >= 20}
            onClick={() => onFaqs([...faqs, { question: "", answer: "" }])}
          >
            Add question +
          </button>
        </div>
      </details>
    </>
  );
}
