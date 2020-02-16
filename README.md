configure-rs2p-certificates
===
Gehirn RS2 Plus にローカルにある証明書を設定する

なにこれ?
---
現時点では certbot の吐く証明書だけ設定できる、ローカルの証明書を RS2 Plus に適用するツール

モチベーション
---
- Let's encrypt の証明書を使いたいが、証明書の更新タイミングで手動でウェブコンソールから証明書を設定したくなかった
    * Let's encrypt 証明書は期限が短かい
    * そもそも手動って忘れるし、面倒じゃないですか
    * *自動化したい!!!!!*
- 誰か書いてるかと思ったらないじゃん
- Undocumented な API だけど叩いてよさそうだったしやっちゃお
    * > ドキュメントを整備していなくてご不便をかけますが、すべての機能には対応する API があって Web コンソールはそれを実行しているので、ブラウザの Developer Console などをみると参考になるかと …
      > https://twitter.com/yosida95/status/1146611221530943488

使い方
---

すでに

- ドメインがある
- ドメインが RS2 Plus に登録されている

ことは前提とする。

初回のみ

- Gehirn RS2 Plus の API キーを取得する
  + 静的鍵を作る
    * [プロジェクト管理機能で静的鍵を追加する \| Gehirn Web Services サポートセンター](https://support.gehirn.jp/manual/project/add-statickey/)
  + ロールを割り当てる
    * [プロジェクト管理機能で APIクライアントにロールを割当てる \| Gehirn Web Services サポートセンター](https://support.gehirn.jp/manual/project/apply-role-to-apikey/)
    * 「Gehirn RS2 Plus アカウント管理者」にするのが最も簡単
        - 後述の設定で `GEHIRN_CONTAINER_ID` で更新対象のプロジェクト (コンテナ) を特定する場合はアカウント個別設定の「Gehirn RS2 Plus アカウント管理者」でよい

必要がある。

実行前には

- Certbot で証明書を取得する
  + DNS で取ると自動化できてよい
  + しかしなんでもよい
- 必要な環境変数がセットされている (後述)

必要がある。

設定は環境変数から行ない、次のように設定する。

```sh
# API 静的鍵の Basic から始まる行を全部コピーする
export GEHIRN_API_AUTHORIZE="(ここに Basic なんたらかんたらが入る)"
# GEHIRN_CONTAINER_ID, GEHIRN_CONTAINER_LABEL はどっちか指定すればよい
export GEHIRN_CONTAINER_ID="(アカウントID)"
export GEHIRN_CONTAINER_LABEL="(アカウントの名前)"
# certbot が証明書を置くディレクトリを指定する
export CERTBOT_DIRECTORY="/etc/letsencrypt"
# 対象のドメインを指定する
export SITE_DOMAIN="example.com"
```

あとは certbot のディレクトリにアクセスできる権限で実行するだけ！

```sh
npm install
npm run
```

TODO
---
- certbot 以外に対応する
- 適当に書いたので TypeScript にする
