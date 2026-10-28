import{q as a,r as p,j as e,C as h,e as x,f as g,g as w,F as l,G as f,B as C}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const v={title:"Forms/Textarea",component:a,tags:["autodocs"],args:{placeholder:"Add a description…",autoGrow:!1,showCount:!1,disabled:!1,rows:3},argTypes:{maxLength:{control:"number"},maxRows:{control:"number"}},decorators:[c=>e.jsx("div",{className:"w-96",children:e.jsx(c,{})})],parameters:{docs:{description:{component:"Multi-line text. `autoGrow` fits the height to the content (capped by `maxRows`),\n`showCount` adds a counter that warns near `maxLength`."}}}},r={},t={args:{autoGrow:!0,rows:2,maxRows:8,defaultValue:`When a workspace has more than 500 members, the people picker takes several seconds to open.
Type a few lines to see the field grow.`}},s={args:{showCount:!0,maxLength:140,defaultValue:"Shipped the new onboarding checklist to 20% of workspaces."}},o={args:{showCount:!0,maxLength:60,defaultValue:"Refactor the sync engine so offline edits merge cleanly"}},n={render:()=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(l,{label:"Disabled",children:e.jsx(a,{disabled:!0,defaultValue:"Archived projects cannot be edited."})}),e.jsx(l,{label:"Read only",children:e.jsx(a,{readOnly:!0,defaultValue:"Imported from GitHub issue #4182."})}),e.jsx(l,{label:"Release notes",error:"Release notes are required to publish",children:e.jsx(a,{placeholder:"What changed in this release?"})})]})},d={render:function(){const[i,m]=p.useState("");return e.jsxs(h,{children:[e.jsx(x,{children:e.jsx(g,{children:"ENG-2148 Slow people picker in large workspaces"})}),e.jsx(w,{children:e.jsx(l,{label:"Leave a comment",description:"Markdown is supported.",children:e.jsx(a,{autoGrow:!0,rows:2,maxRows:10,value:i,onChange:u=>m(u.target.value),placeholder:"Leave a comment…"})})}),e.jsx(f,{className:"justify-end",children:e.jsx(C,{variant:"primary",size:"sm",disabled:!i.trim(),children:"Comment"})})]})}},y=["Playground","AutoGrow","CharacterCount","NearTheLimit","States","InAComment"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    autoGrow: true,
    rows: 2,
    maxRows: 8,
    defaultValue: "When a workspace has more than 500 members, the people picker takes several seconds to open.\\nType a few lines to see the field grow."
  }
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    showCount: true,
    maxLength: 140,
    defaultValue: "Shipped the new onboarding checklist to 20% of workspaces."
  }
}`,...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    showCount: true,
    maxLength: 60,
    defaultValue: "Refactor the sync engine so offline edits merge cleanly"
  }
}`,...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <Textarea disabled defaultValue="Archived projects cannot be edited." />
      </Field>
      <Field label="Read only">
        <Textarea readOnly defaultValue="Imported from GitHub issue #4182." />
      </Field>
      <Field label="Release notes" error="Release notes are required to publish">
        <Textarea placeholder="What changed in this release?" />
      </Field>
    </div>
}`,...n.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [comment, setComment] = useState("");
    return <Card>
        <CardHeader>
          <CardTitle>ENG-2148 Slow people picker in large workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Leave a comment" description="Markdown is supported.">
            <Textarea autoGrow rows={2} maxRows={10} value={comment} onChange={event => setComment(event.target.value)} placeholder="Leave a comment…" />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="primary" size="sm" disabled={!comment.trim()}>
            Comment
          </Button>
        </CardFooter>
      </Card>;
  }
}`,...d.parameters?.docs?.source}}};export{t as AutoGrow,s as CharacterCount,d as InAComment,o as NearTheLimit,r as Playground,n as States,y as __namedExportsOrder,v as default};
