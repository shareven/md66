#!/bin/bash
# 生成 md66 应用图标（visual-image-generator 五段式提示词）并更新全套资源
# 用法：bash scripts/gen-logo.sh
set -e

PROMPT="深群青到亮钴蓝的柔和渐变铺满整个圆角方形画布，画面光感干净通透；标志由字标 md66 构成，纯白几何艺术字居中，m 与 d 的圆拱笔画和 66 的圆环连成一条节奏线，d 的竖笔做成闪烁文本光标形态，画布右上角一枚小小的半透明白色井号符号角标；极简开发工具图标结合几何字标系统与清爽科技编辑；深群青蓝、亮钴蓝、纯白配色；文字：md66，字标做成和图标同源的白色几何艺术字，笔画带轻微厚度和切角，每组文字都要有融入画面的视觉设计，不是直接把字打在图上；主标题、主体和所有文字完整居中在画框内，四周留出安全边距，不贴边、不裁切。"

ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$PROMPT")
curl -sSL "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${ENCODED}&image_size=square_hd" -o /tmp/md66-logo.raw
file /tmp/md66-logo.raw
